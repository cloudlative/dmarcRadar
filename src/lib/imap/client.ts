import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decryptSecret } from "@/lib/crypto";
import { extractXml, parseDmarcXml } from "@/lib/dmarc/parse";
import { storeReport } from "@/lib/dmarc/store";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { MailboxConfig } from "@prisma/client";

const REPORT_ATTACHMENT_EXTENSIONS = [".xml", ".gz", ".zip"];

export interface PollSummary {
  mailboxId: string;
  messagesScanned: number;
  reportsCreated: number;
  reportsDuplicate: number;
  errors: number;
  rescannedFromStart: boolean;
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
  });

  let maxUidSeen = config.lastUid ?? 0;
  let currentUidValidity = config.uidValidity;

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
      const hasNewMessages = startUid <= mailbox.uidNext - 1;

      if (hasNewMessages) {
        for await (const message of client.fetch(
          `${startUid}:*`,
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

  await prisma.mailboxConfig.update({
    where: { id: config.id },
    data: { lastPolledAt: new Date(), lastUid: maxUidSeen, uidValidity: currentUidValidity },
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
      });
    }
  }
  return summaries;
}
