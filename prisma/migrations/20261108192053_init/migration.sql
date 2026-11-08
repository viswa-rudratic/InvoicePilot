-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClientMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "standardRateCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "totalAmountStr" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueDate" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT,
    "invoiceId" TEXT,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payloadSnapshot" TEXT NOT NULL,
    "maxAmountApprovedCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_USER',
    "createRequestId" TEXT,
    "sendRequestId" TEXT,
    "operationRequestId" TEXT,
    "paypalInvoiceId" TEXT,
    "claimedAt" DATETIME,
    "usedAt" DATETIME,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalRecord_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "InvoiceProposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "proposalId" TEXT,
    "recordType" TEXT NOT NULL,
    "paypalInvoiceId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "totalAmountStr" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueDate" TEXT NOT NULL,
    "invoiceDate" TEXT NOT NULL,
    "recipientViewUrl" TEXT,
    "invoicerViewUrl" TEXT,
    "notes" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastRemindedAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "InvoiceProposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayPalApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMemory_userId_email_key" ON "ClientMemory"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_proposalId_key" ON "Invoice"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paypalInvoiceId_key" ON "Invoice"("paypalInvoiceId");
