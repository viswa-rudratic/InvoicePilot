import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPayPalInvoice } from '@/lib/paypal';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const demoUser = await prisma.user.findFirst();
    if (!demoUser) {
      return NextResponse.json({ error: 'Demo user not found' }, { status: 500 });
    }

    // Fetch all PayPal-synced invoices
    const syncedInvoices = await prisma.invoice.findMany({
      where: {
        userId: demoUser.id,
        recordType: 'PAYPAL_SYNCED',
        paypalInvoiceId: { not: null },
      },
    });

    const results: Array<{ id: string; oldStatus: string; newStatus: string }> = [];

    for (const inv of syncedInvoices) {
      if (!inv.paypalInvoiceId) continue;
      try {
        const livePayPalData = await getPayPalInvoice(inv.paypalInvoiceId);
        const liveStatus = livePayPalData.status;
        const recipientViewUrl =
          livePayPalData.detail?.metadata?.recipient_view_url || inv.recipientViewUrl;

        if (liveStatus && liveStatus !== inv.status) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              status: liveStatus,
              recipientViewUrl,
              lastSyncedAt: new Date(),
            },
          });
          results.push({ id: inv.id, oldStatus: inv.status, newStatus: liveStatus });
        } else {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { lastSyncedAt: new Date() },
          });
        }
      } catch (syncErr) {
        logger.warn(`Failed to sync invoice ${inv.paypalInvoiceId}`, syncErr);
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: syncedInvoices.length,
      updatedInvoices: results,
      message: `Synchronized ${syncedInvoices.length} PayPal invoice(s). ${results.length} status change(s) detected.`,
    });
  } catch (err: any) {
    logger.error('PayPal Sync Route Error', err);
    return NextResponse.json({ error: err.message || 'PayPal sync failed' }, { status: 500 });
  }
}
