ALTER TABLE "MailboxConfig" ALTER COLUMN "name" SET NOT NULL;
CREATE UNIQUE INDEX "MailboxConfig_name_key" ON "MailboxConfig"("name");
