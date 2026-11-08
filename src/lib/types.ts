import { z } from 'zod';

// ==============================================================================
// Currency & Monetary Constraints
// ==============================================================================
export const SUPPORTED_CURRENCY = 'USD' as const;

// Item Schema (Zod)
export const InvoiceItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional().default(''),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitAmountCents: z.number().int().nonnegative('Unit amount in cents must be >= 0'),
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

// Proposal Input Schema (Zod)
export const CreateProposalInputSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email('Valid client email is required'),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item is required'),
  currency: z.literal(SUPPORTED_CURRENCY).default(SUPPORTED_CURRENCY),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  notes: z.string().optional().default(''),
});

export type CreateProposalInput = z.infer<typeof CreateProposalInputSchema>;

// Reminder Schema (Zod)
export const DraftReminderInputSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  tone: z.enum(['polite', 'firm']).default('polite'),
});

export type DraftReminderInput = z.infer<typeof DraftReminderInputSchema>;

// ==============================================================================
// PayPal Status Mapping (Comprehensive)
// ==============================================================================
export const PAYPAL_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'SENT',
  'UNPAID',
  'PAID',
  'MARKED_AS_PAID',
  'PARTIALLY_PAID',
  'PAYMENT_PENDING',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'MARKED_AS_REFUNDED',
] as const;

export type PayPalStatus = typeof PAYPAL_STATUSES[number];

// ==============================================================================
// Financial & Overdue Math (IST Date-Only)
// ==============================================================================

/**
 * Returns today's calendar date in IST (Asia/Kolkata) as 'YYYY-MM-DD'
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Determines whether an invoice is strictly overdue.
 * Invariant: Only SENT, UNPAID, PARTIALLY_PAID, PAYMENT_PENDING can be overdue.
 * DRAFT and SCHEDULED are NEVER overdue.
 * Unknown statuses are NEVER overdue.
 */
export function isOverdue(dueDate: string, status: string): boolean {
  const activeUnsettledStatuses = ['SENT', 'UNPAID', 'PARTIALLY_PAID', 'PAYMENT_PENDING'];
  if (!activeUnsettledStatuses.includes(status)) {
    return false;
  }
  return dueDate < getTodayIST();
}

/**
 * Computes deterministic total in integer minor units (cents)
 */
export function computeTotalCents(items: InvoiceItem[]): number {
  return items.reduce((acc, item) => acc + item.quantity * item.unitAmountCents, 0);
}

/**
 * Formats integer cents to standard decimal string, e.g. 2500 -> "25.00"
 */
export function formatCentsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
