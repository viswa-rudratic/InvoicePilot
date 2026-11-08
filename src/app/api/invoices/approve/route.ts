import { NextRequest, NextResponse } from 'next/server';
import { approveProposal } from '@/lib/approval';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    if (!proposalId) {
      return NextResponse.json({ error: 'proposalId is required' }, { status: 400 });
    }

    const demoUser = await prisma.user.findFirst();
    if (!demoUser) {
      return NextResponse.json({ error: 'Demo user not found' }, { status: 500 });
    }

    const result = await approveProposal(proposalId, demoUser.id);
    return NextResponse.json({
      success: true,
      approvalId: result.approvalId,
      status: result.status,
      message: 'Proposal successfully approved. Ready to send to PayPal.',
    });
  } catch (err: any) {
    logger.error('Approval Route Error', err);
    return NextResponse.json({ error: err.message || 'Approval failed' }, { status: 422 });
  }
}
