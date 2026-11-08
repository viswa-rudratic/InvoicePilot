import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isOverdue, formatCentsToDecimal, getTodayIST } from '@/lib/types';

export async function GET() {
  try {
    const demoUser = await prisma.user.findFirst();
    if (!demoUser) {
      return NextResponse.json({ error: 'Demo user not found' }, { status: 500 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { userId: demoUser.id },
      include: {
        approvals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const todayIST = getTodayIST();

    const formatted = invoices.map((inv) => {
      const overdue = isOverdue(inv.dueDate, inv.status);
      const latestApproval = inv.approvals[0];

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        paypalInvoiceId: inv.paypalInvoiceId,
        recordType: inv.recordType, // PAYPAL_SYNCED | LOCAL_DEMO
        status: inv.status,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        totalAmountCents: inv.totalAmountCents,
        totalAmountStr: inv.totalAmountStr,
        currency: inv.currency,
        dueDate: inv.dueDate,
        invoiceDate: inv.invoiceDate,
        recipientViewUrl: inv.recipientViewUrl,
        notes: inv.notes,
        isOverdue: overdue,
        lastSyncedAt: inv.lastSyncedAt,
        // Include approval info for retry send if draft
        latestApprovalId: latestApproval ? latestApproval.id : null,
        approvalStatus: latestApproval ? latestApproval.status : null,
      };
    });

    // Summary numbers (code-computed, never invented)
    const totalInvoicedCents = formatted.reduce((acc, i) => acc + i.totalAmountCents, 0);
    const totalCollectedCents = formatted
      .filter((i) => i.status === 'PAID' || i.status === 'MARKED_AS_PAID')
      .reduce((acc, i) => acc + i.totalAmountCents, 0);
    const totalOverdueCents = formatted
      .filter((i) => i.isOverdue)
      .reduce((acc, i) => acc + i.totalAmountCents, 0);
    const totalOutstandingCents = formatted
      .filter((i) => i.status !== 'PAID' && i.status !== 'MARKED_AS_PAID' && i.status !== 'CANCELLED')
      .reduce((acc, i) => acc + i.totalAmountCents, 0);

    return NextResponse.json({
      todayIST,
      summary: {
        totalInvoicedStr: formatCentsToDecimal(totalInvoicedCents),
        totalCollectedStr: formatCentsToDecimal(totalCollectedCents),
        totalOutstandingStr: formatCentsToDecimal(totalOutstandingCents),
        totalOverdueStr: formatCentsToDecimal(totalOverdueCents),
        totalCount: formatted.length,
        overdueCount: formatted.filter((i) => i.isOverdue).length,
        paidCount: formatted.filter((i) => i.status === 'PAID' || i.status === 'MARKED_AS_PAID').length,
      },
      invoices: formatted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list invoices' }, { status: 500 });
  }
}
