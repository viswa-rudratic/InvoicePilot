import { NextRequest, NextResponse } from 'next/server';
import { executeRetrySend } from '@/lib/approval';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { approvalId } = body;

    if (!approvalId) {
      return NextResponse.json({ error: 'approvalId is required' }, { status: 400 });
    }

    const demoUser = await prisma.user.findFirst();
    if (!demoUser) {
      return NextResponse.json({ error: 'Demo user not found' }, { status: 500 });
    }

    const result = await executeRetrySend(approvalId, demoUser.id);
    return NextResponse.json({
      success: true,
      invoiceId: result.invoiceId,
      status: result.status,
      recipientViewUrl: result.recipientViewUrl,
      message: 'Draft invoice successfully dispatched on retry without duplicate creation.',
    });
  } catch (err: any) {
    logger.error('Retry Send Route Error', err);
    return NextResponse.json({ error: err.message || 'Retry send failed' }, { status: 422 });
  }
}
