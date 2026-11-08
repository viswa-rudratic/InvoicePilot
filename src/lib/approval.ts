// ==============================================================================
// InvoicePilot - Approval Engine & Tamper-Proofing Security Gate
// Enforces human-in-the-loop governance:
// - AWAITING_USER -> PENDING -> IN_PROGRESS -> USED / FAILED / REVOKED / TAMPERED
// - Direct immutable payloadSnapshot string wire dispatch
// - Cryptographic SHA-256 integrity verification
// - Hard money caps and atomic claiming
// ==============================================================================

import crypto from 'node:crypto';
import { prisma } from './db';
import { logger } from './logger';
import {
  CreateProposalInput,
  computeTotalCents,
  formatCentsToDecimal,
  getTodayIST,
  InvoiceItem,
} from './types';
import { createPayPalInvoice, sendPayPalInvoice, remindPayPalInvoice } from './paypal';

/**
 * Returns canonical JSON string with recursively sorted object keys
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizeJson((obj as Record<string, unknown>)[key])}`
  );
  return `{${entries.join(',')}}`;
}

/**
 * Computes SHA-256 hash of a canonical string
 */
export function computePayloadHash(canonicalString: string): string {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Get configured maximum invoice amount cap in integer cents
 */
export function getMaxAmountCapCents(): number {
  const capStr = process.env.MAX_INVOICE_AMOUNT_CAP;
  const parsed = capStr ? parseInt(capStr, 10) : 1000000; // Default $10,000.00 (1,000,000 cents)
  return isNaN(parsed) ? 1000000 : parsed;
}

/**
 * Generates the full canonical PayPal payload string for an invoice
 */
export function buildCanonicalPayPalPayload(params: {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  merchantEmail: string;
  clientEmail: string;
  items: InvoiceItem[];
  notes?: string;
}): string {
  const rawPayload = {
    detail: {
      currency_code: 'USD',
      invoice_date: params.invoiceDate,
      invoice_number: params.invoiceNumber,
      note: params.notes || 'Thank you for your business. Generated via InvoicePilot.',
      payment_term: {
        due_date: params.dueDate,
        term_type: 'DUE_ON_DATE_SPECIFIED',
      },
    },
    invoicer: {
      email_address: params.merchantEmail,
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: params.clientEmail,
        },
      },
    ],
    items: params.items.map((it) => ({
      name: it.name,
      description: it.description || '',
      quantity: it.quantity.toString(),
      unit_amount: {
        currency_code: 'USD',
        value: formatCentsToDecimal(it.unitAmountCents),
      },
    })),
    configuration: {
      allow_tip: false,
      tax_calculated_after_discount: true,
      tax_inclusive: false,
    },
  };

  return canonicalizeJson(rawPayload);
}

/**
 * Creates an Invoice Proposal together with a locked AWAITING_USER ApprovalRecord
 */
export async function createProposalWithApproval(
  userId: string,
  input: CreateProposalInput
): Promise<{ proposalId: string; approvalId: string; totalAmountStr: string }> {
  const merchantEmail = process.env.PAYPAL_MERCHANT_EMAIL?.trim();
  if (!merchantEmail) {
    throw new Error('PAYPAL_MERCHANT_EMAIL is not configured.');
  }

  const totalCents = computeTotalCents(input.items);
  const maxCap = getMaxAmountCapCents();

  if (totalCents > maxCap) {
    throw new Error(
      `Invoice amount ($${formatCentsToDecimal(totalCents)}) exceeds configured limit of $${formatCentsToDecimal(maxCap)}.`
    );
  }

  const totalAmountStr = formatCentsToDecimal(totalCents);
  const invoiceNumber = `INV-PILOT-${Date.now().toString().slice(-6)}`;
  const invoiceDate = getTodayIST();

  // 1. Generate canonical PayPal payload string
  const canonicalPayload = buildCanonicalPayPalPayload({
    invoiceNumber,
    invoiceDate,
    dueDate: input.dueDate,
    merchantEmail,
    clientEmail: input.clientEmail,
    items: input.items,
    notes: input.notes,
  });

  // 2. Cryptographic SHA-256 hash
  const payloadHash = computePayloadHash(canonicalPayload);

  // 3. Persistent idempotency request IDs
  const createRequestId = crypto.randomUUID();
  const sendRequestId = crypto.randomUUID();

  // 4. Atomic database insertion
  const proposal = await prisma.invoiceProposal.create({
    data: {
      userId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      itemsJson: JSON.stringify(input.items),
      totalAmountCents: totalCents,
      totalAmountStr,
      currency: 'USD',
      dueDate: input.dueDate,
      notes: input.notes,
      status: 'PENDING_APPROVAL',
      approvals: {
        create: {
          userId,
          kind: 'INVOICE',
          payloadHash,
          payloadSnapshot: canonicalPayload,
          maxAmountApprovedCents: totalCents,
          status: 'AWAITING_USER', // Awaiting explicit user click
          approvedAt: null,
          createRequestId,
          sendRequestId,
        },
      },
    },
    include: {
      approvals: true,
    },
  });

  const approval = proposal.approvals[0];

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PROPOSAL_CREATED',
      entityType: 'InvoiceProposal',
      entityId: proposal.id,
      detailsJson: JSON.stringify({
        totalAmountStr,
        clientEmail: input.clientEmail,
        approvalId: approval.id,
      }),
    },
  });

  logger.info(`Invoice proposal created (${proposal.id}) with approval (${approval.id}) in AWAITING_USER state`);
  return { proposalId: proposal.id, approvalId: approval.id, totalAmountStr };
}

/**
 * Explicit user click to Approve: transitions approval from AWAITING_USER -> PENDING
 */
export async function approveProposal(
  proposalId: string,
  userId: string
): Promise<{ approvalId: string; status: string }> {
  // Find latest approval record awaiting user or already pending
  const approval = await prisma.approvalRecord.findFirst({
    where: {
      proposalId,
      userId,
      kind: 'INVOICE',
      status: { in: ['AWAITING_USER', 'PENDING'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!approval) {
    throw new Error('No pending approval awaiting user confirmation found for this proposal.');
  }

  // If already PENDING, return it idempotently
  if (approval.status === 'PENDING') {
    return { approvalId: approval.id, status: approval.status };
  }

  // Verify amount cap against snapshot
  const maxCap = getMaxAmountCapCents();
  if (approval.maxAmountApprovedCents > maxCap) {
    throw new Error('Approved amount exceeds maximum configured limit.');
  }

  // Update approval to PENDING (ready for send execution)
  const updated = await prisma.approvalRecord.update({
    where: { id: approval.id },
    data: {
      status: 'PENDING',
      approvedAt: new Date(),
    },
  });

  await prisma.invoiceProposal.update({
    where: { id: proposalId },
    data: { status: 'APPROVED' },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'APPROVAL_GRANTED',
      entityType: 'ApprovalRecord',
      entityId: updated.id,
      detailsJson: JSON.stringify({ proposalId, approvedAt: updated.approvedAt }),
    },
  });

  logger.info(`Proposal ${proposalId} explicitly approved by user. ApprovalRecord ${updated.id} status is now PENDING.`);
  return { approvalId: updated.id, status: updated.status };
}

/**
 * Revokes any pending approvals when a proposal is modified
 */
export async function revokePendingApprovals(proposalId: string, userId: string): Promise<void> {
  const result = await prisma.approvalRecord.updateMany({
    where: {
      proposalId,
      userId,
      status: { in: ['AWAITING_USER', 'PENDING'] },
    },
    data: {
      status: 'REVOKED',
    },
  });

  if (result.count > 0) {
    logger.info(`Revoked ${result.count} existing approval(s) for modified proposal ${proposalId}`);
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'APPROVAL_REVOKED',
        entityType: 'ApprovalRecord',
        entityId: proposalId,
        detailsJson: JSON.stringify({ revokedCount: result.count }),
      },
    });
  }
}

/**
 * Pre-Send Security Gate & Execution
 * Dispatches the exact payloadSnapshot string directly to PayPal.
 */
export async function executeSendInvoice(
  approvalId: string,
  userId: string
): Promise<{ invoiceId: string; status: string; recipientViewUrl?: string }> {
  // 1. Atomic claim: PENDING -> IN_PROGRESS (with stale-claim timeout > 5m)
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

  const claimResult = await prisma.approvalRecord.updateMany({
    where: {
      id: approvalId,
      OR: [
        { status: 'PENDING' },
        { status: 'IN_PROGRESS', claimedAt: { lt: staleThreshold } },
      ],
    },
    data: {
      status: 'IN_PROGRESS',
      claimedAt: new Date(),
    },
  });

  if (claimResult.count === 0) {
    throw new Error('Approval is invalid, already in progress, or already used.');
  }

  // 2. Fetch locked record
  const approval = await prisma.approvalRecord.findUnique({
    where: { id: approvalId },
    include: { proposal: true },
  });

  if (!approval || !approval.createRequestId || !approval.sendRequestId) {
    throw new Error('Corrupt or missing approval record.');
  }

  // 3. Security Checks:
  // - Demo user ownership
  if (approval.userId !== userId) {
    throw new Error('Unauthorized: approval record does not belong to authenticated user session.');
  }

  // - Cryptographic SHA-256 hash verification
  const computedHash = computePayloadHash(approval.payloadSnapshot);
  if (computedHash !== approval.payloadHash) {
    // Flag as TAMPERED in database
    await prisma.approvalRecord.update({
      where: { id: approvalId },
      data: { status: 'TAMPERED' },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'TAMPER_ATTEMPT',
        entityType: 'ApprovalRecord',
        entityId: approvalId,
        detailsJson: JSON.stringify({
          storedHash: approval.payloadHash,
          computedHash,
        }),
      },
    });
    logger.error(`SECURITY ALERT: Payload snapshot hash mismatch on approval ${approvalId}!`);
    throw new Error('Security Error: Tamper detected! Approval snapshot does not match cryptographic hash.');
  }

  // - Item cap check recomputed from snapshot items
  const maxCap = getMaxAmountCapCents();
  if (approval.maxAmountApprovedCents > maxCap) {
    throw new Error(`Amount exceeds maximum permitted cap of $${formatCentsToDecimal(maxCap)}.`);
  }

  let paypalInvoiceId = approval.paypalInvoiceId;
  let parsedSnapshot: any;
  try {
    parsedSnapshot = JSON.parse(approval.payloadSnapshot);
  } catch {
    throw new Error('Invalid JSON snapshot.');
  }

  // 4. Step A: Create Draft on PayPal (if not already created)
  if (!paypalInvoiceId) {
    try {
      const createRes = await createPayPalInvoice(approval.payloadSnapshot, approval.createRequestId);
      paypalInvoiceId = createRes.invoiceId;

      // Update approval record with tracked paypalInvoiceId immediately
      await prisma.approvalRecord.update({
        where: { id: approvalId },
        data: { paypalInvoiceId },
      });

      // Create draft Invoice row in SQLite so dashboard immediately displays retryable draft
      await prisma.invoice.create({
        data: {
          userId,
          proposalId: approval.proposalId,
          recordType: 'PAYPAL_SYNCED',
          paypalInvoiceId,
          invoiceNumber: parsedSnapshot.detail.invoice_number,
          status: 'DRAFT',
          clientName: approval.proposal?.clientName || 'Client',
          clientEmail: parsedSnapshot.primary_recipients[0].billing_info.email_address,
          itemsJson: JSON.stringify(parsedSnapshot.items),
          totalAmountCents: approval.maxAmountApprovedCents,
          totalAmountStr: formatCentsToDecimal(approval.maxAmountApprovedCents),
          currency: 'USD',
          dueDate: parsedSnapshot.detail.payment_term.due_date,
          invoiceDate: parsedSnapshot.detail.invoice_date,
          notes: parsedSnapshot.detail.note,
        },
      });

      logger.info(`PayPal draft invoice ${paypalInvoiceId} registered in SQLite with status DRAFT`);
    } catch (createErr) {
      // Creation failed; keep approval IN_PROGRESS or mark FAILED
      logger.error('Failed in PayPal draft creation stage', createErr);
      throw createErr;
    }
  }

  // 5. Step B: Dispatch / Send Invoice
  try {
    const sendRes = await sendPayPalInvoice(paypalInvoiceId, approval.sendRequestId);

    // Finalize state: Invoice status -> SENT, ApprovalRecord status -> USED
    await prisma.invoice.update({
      where: { paypalInvoiceId },
      data: {
        status: 'SENT',
        recipientViewUrl: sendRes.recipientViewUrl,
        lastSyncedAt: new Date(),
      },
    });

    await prisma.approvalRecord.update({
      where: { id: approvalId },
      data: {
        status: 'USED',
        usedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'INVOICE_SENT',
        entityType: 'Invoice',
        entityId: paypalInvoiceId,
        detailsJson: JSON.stringify({
          approvalId,
          paypalInvoiceId,
          recipientViewUrl: sendRes.recipientViewUrl,
        }),
      },
    });

    logger.info(`Invoice ${paypalInvoiceId} sent successfully; approval ${approvalId} marked USED.`);
    return {
      invoiceId: paypalInvoiceId,
      status: 'SENT',
      recipientViewUrl: sendRes.recipientViewUrl,
    };
  } catch (sendErr) {
    logger.error(`Send stage failed for draft invoice ${paypalInvoiceId}`, sendErr);
    // Draft exists in SQLite with status DRAFT. Approval is IN_PROGRESS with paypalInvoiceId set.
    // User can trigger executeRetrySend!
    throw new Error(
      `Invoice draft created (${paypalInvoiceId}) but dispatch failed. You may retry sending without creating a duplicate invoice.`
    );
  }
}

/**
 * User-Initiated Retry Send: Resumes an IN_PROGRESS approval that has a paypalInvoiceId set
 */
export async function executeRetrySend(
  approvalId: string,
  userId: string
): Promise<{ invoiceId: string; status: string; recipientViewUrl?: string }> {
  const approval = await prisma.approvalRecord.findUnique({
    where: { id: approvalId },
  });

  if (!approval || approval.userId !== userId) {
    throw new Error('Approval record not found or unauthorized.');
  }

  if (approval.status !== 'IN_PROGRESS' || !approval.paypalInvoiceId || !approval.sendRequestId) {
    throw new Error('Retry Send is only permitted for IN_PROGRESS approvals with an existing draft invoice.');
  }

  // Verify hash integrity before retry
  const computedHash = computePayloadHash(approval.payloadSnapshot);
  if (computedHash !== approval.payloadHash) {
    throw new Error('Security Error: Tamper detected during retry validation.');
  }

  logger.info(`Resuming retry send for draft invoice ${approval.paypalInvoiceId} using persistent sendRequestId`);

  // Skips draft creation, calls send directly with persistent sendRequestId
  const sendRes = await sendPayPalInvoice(approval.paypalInvoiceId, approval.sendRequestId);

  await prisma.invoice.update({
    where: { paypalInvoiceId: approval.paypalInvoiceId },
    data: {
      status: 'SENT',
      recipientViewUrl: sendRes.recipientViewUrl,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.approvalRecord.update({
    where: { id: approvalId },
    data: {
      status: 'USED',
      usedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'INVOICE_SENT_RETRY',
      entityType: 'Invoice',
      entityId: approval.paypalInvoiceId,
      detailsJson: JSON.stringify({
        approvalId,
        paypalInvoiceId: approval.paypalInvoiceId,
      }),
    },
  });

  return {
    invoiceId: approval.paypalInvoiceId,
    status: 'SENT',
    recipientViewUrl: sendRes.recipientViewUrl,
  };
}

/**
 * User-Initiated Send Reminder: Executes reminder dispatch after human approval
 */
export async function executeSendReminder(
  approvalId: string,
  userId: string
): Promise<{ success: boolean; invoiceNumber: string; message: string }> {
  // 1. Atomic claim: AWAITING_USER / PENDING -> IN_PROGRESS
  const claimResult = await prisma.approvalRecord.updateMany({
    where: {
      id: approvalId,
      userId,
      kind: 'REMINDER',
      status: { in: ['AWAITING_USER', 'PENDING'] },
    },
    data: {
      status: 'IN_PROGRESS',
      claimedAt: new Date(),
    },
  });

  if (claimResult.count === 0) {
    throw new Error('Reminder approval is invalid, already in progress, or already used.');
  }

  const approval = await prisma.approvalRecord.findUnique({
    where: { id: approvalId },
    include: { invoice: true },
  });

  if (!approval || !approval.invoice) {
    throw new Error('Approval or associated invoice record not found.');
  }

  // Cryptographic SHA-256 integrity verification
  const computedHash = computePayloadHash(approval.payloadSnapshot);
  if (computedHash !== approval.payloadHash) {
    await prisma.approvalRecord.update({
      where: { id: approvalId },
      data: { status: 'TAMPERED' },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'TAMPER_ATTEMPT',
        entityType: 'ApprovalRecord',
        entityId: approvalId,
        detailsJson: JSON.stringify({ storedHash: approval.payloadHash, computedHash }),
      },
    });
    throw new Error('Security Error: Tamper detected! Reminder snapshot does not match hash.');
  }

  const parsed = JSON.parse(approval.payloadSnapshot);
  const subject = parsed.notification?.subject || 'Payment Reminder';
  const note = parsed.notification?.note || 'Please pay your invoice.';
  const reqId = approval.operationRequestId || crypto.randomUUID();

  // If live PayPal invoice, dispatch to PayPal Invoicing v2 remind API
  if (approval.invoice.recordType === 'PAYPAL_SYNCED' && approval.invoice.paypalInvoiceId) {
    await remindPayPalInvoice(approval.invoice.paypalInvoiceId, subject, note, reqId);
  }

  // Update invoice lastRemindedAt & reminderCount
  await prisma.invoice.update({
    where: { id: approval.invoice.id },
    data: {
      lastRemindedAt: new Date(),
      reminderCount: { increment: 1 },
    },
  });

  // Mark approval USED
  await prisma.approvalRecord.update({
    where: { id: approvalId },
    data: {
      status: 'USED',
      usedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'REMINDER_SENT',
      entityType: 'Invoice',
      entityId: approval.invoice.id,
      detailsJson: JSON.stringify({
        invoiceNumber: approval.invoice.invoiceNumber,
        subject,
        paypalInvoiceId: approval.invoice.paypalInvoiceId,
      }),
    },
  });

  return {
    success: true,
    invoiceNumber: approval.invoice.invoiceNumber,
    message: `Payment reminder successfully sent for invoice ${approval.invoice.invoiceNumber}.`,
  };
}
