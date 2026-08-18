-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('UPLOAD', 'EMAIL');

-- CreateEnum
CREATE TYPE "Disposition" AS ENUM ('none', 'quarantine', 'reject');

-- CreateEnum
CREATE TYPE "AuthResult" AS ENUM ('pass', 'fail', 'softfail', 'neutral', 'none', 'temperror', 'permerror');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxConfig" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "lastPolledAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "email" TEXT,
    "reportId" TEXT NOT NULL,
    "dateRangeBegin" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "policyDomain" TEXT NOT NULL,
    "policyAdkim" TEXT,
    "policyAspf" TEXT,
    "policyP" TEXT,
    "policySp" TEXT,
    "policyPct" INTEGER,
    "sourceType" "SourceType" NOT NULL,
    "rawXmlPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "disposition" "Disposition" NOT NULL,
    "dkimResult" "AuthResult" NOT NULL,
    "spfResult" "AuthResult" NOT NULL,
    "headerFrom" TEXT,
    "envelopeFrom" TEXT,
    "envelopeTo" TEXT,
    "dkimDomain" TEXT,
    "dkimSelector" TEXT,
    "dkimAuthResult" "AuthResult",
    "spfDomain" TEXT,
    "spfAuthResult" "AuthResult",

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_name_key" ON "Domain"("name");

-- CreateIndex
CREATE INDEX "Report_domainId_idx" ON "Report"("domainId");

-- CreateIndex
CREATE INDEX "Report_dateRangeBegin_dateRangeEnd_idx" ON "Report"("dateRangeBegin", "dateRangeEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportId_orgName_domainId_key" ON "Report"("reportId", "orgName", "domainId");

-- CreateIndex
CREATE INDEX "Record_reportId_idx" ON "Record"("reportId");

-- CreateIndex
CREATE INDEX "Record_sourceIp_idx" ON "Record"("sourceIp");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
