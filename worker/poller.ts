import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { pollMailbox } from "@/lib/imap/client";
import { logger } from "@/lib/logger";

interface ScheduledEntry {
  task: cron.ScheduledTask;
  pollIntervalMinutes: number;
}

const scheduled = new Map<string, ScheduledEntry>();

/** Re-scans MailboxConfig rows every minute and (re)schedules a cron job per enabled mailbox
 * at its configured poll interval, stopping jobs for mailboxes that were disabled/removed or
 * whose interval changed. Simpler than a dynamic rescheduling library and cheap enough to run
 * every minute against a handful of mailbox rows. */
async function reconcileSchedules() {
  const configs = await prisma.mailboxConfig.findMany({ where: { enabled: true } });
  const activeIds = new Set(configs.map((c) => c.id));

  for (const [id, entry] of scheduled) {
    if (!activeIds.has(id)) {
      entry.task.stop();
      scheduled.delete(id);
      logger.info({ mailboxId: id }, "stopped poll schedule for disabled/removed mailbox");
    }
  }

  for (const config of configs) {
    const existing = scheduled.get(config.id);
    if (existing && existing.pollIntervalMinutes === config.pollIntervalMinutes) continue;
    existing?.task.stop();

    const cronExpr = `*/${Math.max(1, config.pollIntervalMinutes)} * * * *`;
    logger.info({ mailboxId: config.id, host: config.host, cronExpr }, "scheduling mailbox poll");

    const task = cron.schedule(cronExpr, async () => {
      const fresh = await prisma.mailboxConfig.findUnique({ where: { id: config.id } });
      if (!fresh || !fresh.enabled) return;
      try {
        await pollMailbox(fresh);
      } catch (err) {
        logger.error({ err, mailboxId: fresh.id }, "scheduled mailbox poll failed");
      }
    });
    scheduled.set(config.id, { task, pollIntervalMinutes: config.pollIntervalMinutes });
  }
}

async function main() {
  logger.info("DMARC ingestion worker starting");
  await reconcileSchedules();
  setInterval(() => {
    reconcileSchedules().catch((err) => logger.error({ err }, "failed to reconcile mailbox schedules"));
  }, 60_000);
}

main().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
