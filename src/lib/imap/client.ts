import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decryptSecret } from "@/lib/crypto";
import { extractXml, parseDmarcXml } from "@/lib/dmarc/parse";
import { storeReport } from "@/lib/dmarc/store";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { MailboxConfig } from "@prisma/client";

const REPORT_ATTACHMENT_EXTENSIONS = [".xml", ".gz", ".zip"];

// Every message in range gets its full source downloaded and MIME-parsed just to check for a
// DMARC attachment — fine for a mailbox dedicated to reports, expensive for a general-purpose
// inbox with years of history. Capping the UID span per call keeps a single poll bounded and
// fast instead of turning the first-ever scan of a large mailbox into a multi-minute request
// with no feedback; lastUid checkpointing (below) means the next poll picks up right after
// where this one stopped, so a big backlog just takes a few polls instead of one giant one.
const MAX_UID_SPAN_PER_POLL = 100;

export interface PollSummary {
  mailboxId: string;
  messagesScanned: number;
  reportsCreated: number;
  reportsDuplicate: number;
  errors: number;
  rescannedFromStart: boolean;
  /** True if this poll stopped at MAX_UID_SPAN_PER_POLL with more backlog left — the next poll
   * (scheduled or manual) picks up right after where this one left off. */
  truncated: boolean;
}

/**
 * Polls a single configured mailbox, extracts DMARC attachments, and stores them.
 *
 * Ingestion progress is tracked by IMAP UID (`lastUid`/`uidValidity` on MailboxConfig), not
 * the `\Seen` flag: `\Seen` is shared mailbox state — a human opening the email in Gmail/Outlook,
 * or another tool touching the same mailbox, would silently mark it seen and this poller would
 * skip it forever. UID tracking is ours alone. On the very first poll (or if the mailbox's
 * uidValidity changes, e.g. it was recreated), there is no prior UID checkpoint, so the whole
 * mailbox is scanned once — this is what picks up pre-existing reports that were already read
 * before the mailbox was ever connected here. The report-level (reportId, orgName, domainId)
 * unique constraint is a second safety net, so re-scanning a range can never double-count.
 */
export async function pollMailbox(config: MailboxConfig): Promise<PollSummary> {
  const summary: PollSummary = {
    mailboxId: config.id,
    messagesScanned: 0,
    reportsCreated: 0,
    reportsDuplicate: 0,
    errors: 0,
    rescannedFromStart: false,
    truncated: false,
  };

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: decryptSecret(config.passwordEncrypted),
    },
    logger: false,
    // Defaults are 90s to connect and 5min of socket inactivity — long enough that a bad
    // host/firewall/credential turns "Poll" into a multi-minute hang with no feedback in the
    // UI. Fail fast instead; a real IMAP server answers well within these.
    connectionTimeout: 20_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  });

  let maxUidSeen = config.lastUid ?? 0;
  let currentUidValidity = config.uidValidity;

  try {
    await client.connect();
    try {
      const lock = await client.getMailboxLock(config.folder);
      try {
        const mailbox = client.mailbox;
        if (!mailbox) throw new Error(`Failed to open mailbox folder "${config.folder}"`);

        currentUidValidity = mailbox.uidValidity;
        const uidValidityChanged = config.uidValidity == null || config.uidValidity !== mailbox.uidValidity;
        summary.rescannedFromStart = uidValidityChanged;
        const startUid = uidValidityChanged ? 1 : (config.lastUid ?? 0) + 1;
        maxUidSeen = uidValidityChanged ? 0 : config.lastUid ?? 0;

        // Guard against the IMAP "N:*" range quirk: if N is past the highest existing UID, the
        // server resolves the range as highest:N instead of returning nothing — so only fetch
        // when we know at least one message could actually match.
        const highestUid = mailbox.uidNext - 1;
        const hasNewMessages = startUid <= highestUid;
        const endUid = Math.min(highestUid, startUid + MAX_UID_SPAN_PER_POLL - 1);
        summary.truncated = hasNewMessages && endUid < highestUid;

        if (hasNewMessages) {
          for await (const message of client.fetch(
            `${startUid}:${endUid}`,
            { envelope: true, source: true, uid: true },
            { uid: true }
          )) {
            summary.messagesScanned += 1;
            if (message.uid > maxUidSeen) maxUidSeen = message.uid;
            if (!message.source) continue;
            try {
              const parsedMail = await simpleParser(message.source as Buffer);
              for (const attachment of parsedMail.attachments) {
                const filename = attachment.filename ?? "";
                const lower = filename.toLowerCase();
                if (!REPORT_ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))) continue;

                try {
                  const xml = extractXml(attachment.content, filename);
                  const parsedReport = parseDmarcXml(xml);
                  const result = await storeReport(parsedReport, "EMAIL", xml);
                  if (result.created) summary.reportsCreated += 1;
                  else summary.reportsDuplicate += 1;
                } catch (err) {
                  summary.errors += 1;
                  logger.error({ err, filename }, "failed to parse DMARC attachment from email");
                }
              }
              // Cosmetic only — marking \Seen is for a human glancing at the mailbox; ingestion
              // progress itself is tracked via lastUid below, never by this flag.
              await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
            } catch (err) {
              summary.errors += 1;
              logger.error({ err }, "failed to process email message during DMARC poll");
            }
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => client.close());
    }
  } catch (err) {
    // Record the failed attempt so it's visible after a refresh instead of only in a toast —
    // this still throws afterward so callers (API routes) see the failure too.
    const message = err instanceof Error ? err.message : "Poll failed";
    await prisma.mailboxConfig.update({
      where: { id: config.id },
      data: { lastPolledAt: new Date(), lastPollError: message },
    });
    throw err;
  }

  await prisma.mailboxConfig.update({
    where: { id: config.id },
    data: { lastPolledAt: new Date(), lastUid: maxUidSeen, uidValidity: currentUidValidity, lastPollError: null },
  });

  logger.info(summary, "mailbox poll complete");
  return summary;
}

/** Polls every enabled mailbox configuration once. */
export async function pollAllEnabledMailboxes(): Promise<PollSummary[]> {
  const configs = await prisma.mailboxConfig.findMany({ where: { enabled: true } });
  const summaries: PollSummary[] = [];
  for (const config of configs) {
    try {
      summaries.push(await pollMailbox(config));
    } catch (err) {
      logger.error({ err, mailboxId: config.id }, "mailbox poll failed");
      summaries.push({
        mailboxId: config.id,
        messagesScanned: 0,
        reportsCreated: 0,
        reportsDuplicate: 0,
        errors: 1,
        rescannedFromStart: false,
        truncated: false,
      });
    }
  }
  return summaries;
}
