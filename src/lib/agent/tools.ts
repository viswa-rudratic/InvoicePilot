// ==============================================================================
// InvoicePilot - Anthropic Agent Tool Definitions & Handlers
// STRICT RULE: AI may ONLY call read/proposal tools.
// Sending invoices or moving money is strictly FORBIDDEN from AI tools.
// All financial totals & overdue statuses are computed deterministically in backend code.
// ==============================================================================

import { z } from 'zod';
import { prisma } from '../db';
import { logger } from '../logger';
import {
  CreateProposalInputSchema,
  computeTotalCents,
  formatCentsToDecimal,
  getTodayIST,
  isOverdue,
  InvoiceItem,
} from '../types';
import {
  createProposalWithApproval,
  buildCanonicalPayPalPayload,
  computePayloadHash,
  canonicalizeJson,
} from '../approval';
import crypto from 'node:crypto';

// ==============================================================================
// 1. Tool Definitions for Anthropic API
// ==============================================================================

export const ANTHROPIC_TOOLS = [
  {
    name: 'lookup_client',
    description:
      'Search client memory for saved clients, their email addresses, and standard hourly or project rates. Always check this before asking the user for client contact information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Client name or partial company name (e.g. "Acme", "TechFlow")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_invoice_proposal',
    description:
      'Creates a structured invoice proposal. Computes line item totals deterministically and locks an approval record in AWAITING_USER state. Does NOT send the invoice—the user must explicitly review and approve it first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientName: {
          type: 'string',
          description: 'Full name or company name of client',
        },
        clientEmail: {
          type: 'string',
          description: 'Valid email address of the client recipient',
        },
        items: {
          type: 'array',
          description: 'List of invoice line items with quantities and unit amounts in integer cents (e.g., $100.00 = 10000)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Item title or service name' },
              description: { type: 'string', description: 'Item description or scope of work' },
              quantity: { type: 'integer', description: 'Item quantity (min 1)' },
              unitAmountCents: {
                type: 'integer',
                description: 'Unit amount in integer cents (e.g. $800 = 80000)',
              },
            },
            required: ['name', 'quantity', 'unitAmountCents'],
          },
        },
        dueDate: {
          type: 'string',
          description: 'Invoice due date in YYYY-MM-DD format (calculated from payment terms or days)',
        },
        notes: {
          type: 'string',
          description: 'Optional note to client, including payment instructions or late fee notes (late fees must ONLY appear as notes, never added charges)',
        },
      },
      required: ['clientName', 'clientEmail', 'items', 'dueDate'],
    },
  },
  {
    name: 'list_invoices',
    description:
      'Lists invoices from the database with calculated overdue status and data honesty badges (PayPal Sandbox live vs Local Demo). Use to answer financial questions like "Who owes me money?", "What invoices are overdue?", or "How much have I collected?".',
    input_schema: {
      type: 'object' as const,
      properties: {
        statusFilter: {
          type: 'string',
          enum: ['ALL', 'PAID', 'MARKED_AS_PAID', 'UNPAID', 'OVERDUE'],
          description: 'Filter invoices by status category',
        },
        clientName: {
          type: 'string',
          description: 'Optional client name filter',
        },
      },
    },
  },
  {
    name: 'get_invoice_status',
    description:
      'Inspects details for a specific invoice, including days overdue or days until due in IST.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceId: {
          type: 'string',
          description: 'Internal database invoice ID or PayPal invoice ID (e.g. INV2-XXXX-XXXX)',
        },
        invoiceNumber: {
          type: 'string',
          description: 'Invoice number (e.g. INV-DEMO-001 or INV-M1-568864)',
        },
      },
    },
  },
  {
    name: 'draft_reminder',
    description:
      'Drafts a polite or firm payment reminder for an unpaid or overdue invoice. Checks the 24-hour reminder limit and creates an approval record in AWAITING_USER state. Does NOT dispatch the reminder—requires explicit user approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceId: {
          type: 'string',
          description: 'Invoice ID to remind',
        },
        tone: {
          type: 'string',
          enum: ['polite', 'firm'],
          description: 'Reminder tone: polite (standard friendly check-in) or firm (past due follow-up)',
        },
      },
      required: ['invoiceId'],
    },
  },
];

// ==============================================================================
// 2. Tool Execution Handlers
// ==============================================================================

/**
 * Tool 1: Lookup Client in Memory
 */
export async function executeLookupClient(
  input: { query: string },
  userId: string
): Promise<unknown> {
  const query = input.query.trim().toLowerCase();

  const clients = await prisma.clientMemory.findMany({
    where: {
      userId,
      OR: [
        { name: { contains: query } },
        { email: { contains: query } },
      ],
    },
  });

  return {
    found: clients.length > 0,
    clients: clients.map((c) => ({
      name: c.name,
      email: c.email,
      standardRate: c.standardRateCents ? `$${formatCentsToDecimal(c.standardRateCents)}` : null,
      standardRateCents: c.standardRateCents,
      currency: c.currency,
      notes: c.notes,
    })),
  };
}

/**
 * Tool 2: Create Invoice Proposal
 */
export async function executeCreateProposal(
  input: unknown,
  userId: string
): Promise<unknown> {
  const parsed = CreateProposalInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: 'Invalid proposal parameters',
      validationDetails: parsed.error.flatten(),
    };
  }

  try {
    const result = await createProposalWithApproval(userId, parsed.data);
    const proposal = await prisma.invoiceProposal.findUnique({
      where: { id: result.proposalId },
    });

    return {
      success: true,
      proposalId: result.proposalId,
      approvalId: result.approvalId,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      totalAmount: `$${result.totalAmountStr} USD`,
      totalAmountCents: proposal?.totalAmountCents,
      dueDate: parsed.data.dueDate,
      items: parsed.data.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: `$${formatCentsToDecimal(it.unitAmountCents)}`,
        lineTotal: `$${formatCentsToDecimal(it.quantity * it.unitAmountCents)}`,
      })),
      notes: parsed.data.notes,
      status: 'AWAITING_USER_APPROVAL',
      message:
        'Invoice proposal created successfully and rendered in the preview card. The invoice will NOT be sent until you click Approve.',
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to create proposal',
    };
  }
}

/**
 * Tool 3: List Invoices with Deterministic Overdue & Financial Computations
 */
export async function executeListInvoices(
  input: { statusFilter?: string; clientName?: string },
  userId: string
): Promise<unknown> {
  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      ...(input.clientName
        ? { clientName: { contains: input.clientName } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  const todayIST = getTodayIST();

  const processed = invoices.map((inv) => {
    const overdue = isOverdue(inv.dueDate, inv.status);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      paypalInvoiceId: inv.paypalInvoiceId,
      recordType: inv.recordType, // PAYPAL_SYNCED or LOCAL_DEMO
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      totalAmount: `$${inv.totalAmountStr} ${inv.currency}`,
      totalAmountCents: inv.totalAmountCents,
      status: inv.status,
      isOverdue: overdue,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      recipientViewUrl: inv.recipientViewUrl,
      notes: inv.notes,
    };
  });

  // Apply status filter
  let filtered = processed;
  if (input.statusFilter) {
    if (input.statusFilter === 'PAID') {
      filtered = processed.filter((i) => i.status === 'PAID');
    } else if (input.statusFilter === 'MARKED_AS_PAID') {
      filtered = processed.filter((i) => i.status === 'MARKED_AS_PAID');
    } else if (input.statusFilter === 'OVERDUE') {
      filtered = processed.filter((i) => i.isOverdue);
    } else if (input.statusFilter === 'UNPAID') {
      filtered = processed.filter(
        (i) => i.status !== 'PAID' && i.status !== 'MARKED_AS_PAID' && i.status !== 'CANCELLED'
      );
    }
  }

  // Deterministic summary calculations (code-computed, never invented by AI)
  const totalInvoicedCents = processed.reduce((acc, i) => acc + i.totalAmountCents, 0);
  const totalCollectedCents = processed
    .filter((i) => i.status === 'PAID' || i.status === 'MARKED_AS_PAID')
    .reduce((acc, i) => acc + i.totalAmountCents, 0);
  const totalOverdueCents = processed
    .filter((i) => i.isOverdue)
    .reduce((acc, i) => acc + i.totalAmountCents, 0);
  const totalOutstandingCents = processed
    .filter((i) => i.status !== 'PAID' && i.status !== 'MARKED_AS_PAID' && i.status !== 'CANCELLED')
    .reduce((acc, i) => acc + i.totalAmountCents, 0);

  return {
    todayIST,
    totalCount: filtered.length,
    summary: {
      totalInvoiced: `$${formatCentsToDecimal(totalInvoicedCents)} USD`,
      totalCollected: `$${formatCentsToDecimal(totalCollectedCents)} USD`,
      totalOutstanding: `$${formatCentsToDecimal(totalOutstandingCents)} USD`,
      totalOverdue: `$${formatCentsToDecimal(totalOverdueCents)} USD`,
      overdueCount: processed.filter((i) => i.isOverdue).length,
    },
    invoices: filtered,
  };
}

/**
 * Tool 4: Get Specific Invoice Status
 */
export async function executeGetInvoiceStatus(
  input: { invoiceId?: string; invoiceNumber?: string },
  userId: string
): Promise<unknown> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      userId,
      OR: [
        input.invoiceId ? { id: input.invoiceId } : {},
        input.invoiceId ? { paypalInvoiceId: input.invoiceId } : {},
        input.invoiceNumber ? { invoiceNumber: input.invoiceNumber } : {},
      ],
    },
  });

  if (!invoice) {
    return { error: 'Invoice not found.' };
  }

  const todayIST = getTodayIST();
  const overdue = isOverdue(invoice.dueDate, invoice.status);

  // Date calculation in IST
  const due = new Date(invoice.dueDate);
  const today = new Date(todayIST);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    paypalInvoiceId: invoice.paypalInvoiceId,
    recordType: invoice.recordType,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    totalAmount: `$${invoice.totalAmountStr} ${invoice.currency}`,
    status: invoice.status,
    isOverdue: overdue,
    dueDate: invoice.dueDate,
    todayIST,
    daysRemaining: diffDays >= 0 ? diffDays : null,
    daysOverdue: diffDays < 0 && overdue ? Math.abs(diffDays) : null,
    recipientViewUrl: invoice.recipientViewUrl,
  };
}

/**
 * Tool 5: Draft Polite or Firm Payment Reminder
 */
export async function executeDraftReminder(
  input: { invoiceId: string; tone?: 'polite' | 'firm' },
  userId: string
): Promise<unknown> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      userId,
      OR: [
        { id: input.invoiceId },
        { paypalInvoiceId: input.invoiceId },
        { invoiceNumber: input.invoiceId },
      ],
    },
  });

  if (!invoice) {
    return { error: 'Invoice not found for reminder.' };
  }

  if (invoice.status === 'PAID' || invoice.status === 'MARKED_AS_PAID') {
    return {
      error: `Invoice ${invoice.invoiceNumber} is already marked as ${invoice.status}. No reminder needed!`,
    };
  }

  // Check 24h reminder rate limit gracefully
  if (invoice.lastRemindedAt) {
    const hoursSinceLastReminder =
      (Date.now() - new Date(invoice.lastRemindedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastReminder < 24 && invoice.reminderCount >= 2) {
      return {
        error: `PayPal rate limit: Maximum of 2 reminders within 24 hours has already been sent for invoice ${invoice.invoiceNumber}. Please wait until tomorrow.`,
      };
    }
  }

  const tone = input.tone || 'polite';
  const subject =
    tone === 'firm'
      ? `PAST DUE: Payment Reminder for Invoice ${invoice.invoiceNumber}`
      : `Friendly Reminder: Invoice ${invoice.invoiceNumber}`;

  const note =
    tone === 'firm'
      ? `Dear ${invoice.clientName},\n\nThis is an urgent follow-up regarding invoice ${invoice.invoiceNumber} ($${invoice.totalAmountStr} ${invoice.currency}), which was due on ${invoice.dueDate}. Kindly submit payment as soon as possible via the PayPal link below.\n\nThank you.`
      : `Hi ${invoice.clientName},\n\nJust a friendly reminder that invoice ${invoice.invoiceNumber} for $${invoice.totalAmountStr} ${invoice.currency} was due on ${invoice.dueDate}. Please let me know if you have any questions or when we can expect payment.\n\nThank you for your business!`;

  const rawReminder = {
    invoiceId: invoice.id,
    paypalInvoiceId: invoice.paypalInvoiceId,
    notification: {
      subject,
      note,
      send_to_invoicer: true,
      send_to_recipient: true,
    },
  };

  const canonicalSnapshot = canonicalizeJson(rawReminder);
  const payloadHash = computePayloadHash(canonicalSnapshot);
  const operationRequestId = crypto.randomUUID();

  // Create ApprovalRecord in AWAITING_USER state (zero automated sending)
  const approval = await prisma.approvalRecord.create({
    data: {
      invoiceId: invoice.id,
      userId,
      kind: 'REMINDER',
      payloadHash,
      payloadSnapshot: canonicalSnapshot,
      maxAmountApprovedCents: invoice.totalAmountCents,
      status: 'AWAITING_USER',
      approvedAt: null,
      operationRequestId,
    },
  });

  return {
    success: true,
    approvalId: approval.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    totalAmount: `$${invoice.totalAmountStr} ${invoice.currency}`,
    dueDate: invoice.dueDate,
    tone,
    draftSubject: subject,
    draftNote: note,
    status: 'AWAITING_USER_APPROVAL',
    message:
      'Payment reminder drafted and ready for your review. The reminder will NOT be sent until you approve it.',
  };
}
