import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const demoUser = await prisma.user.findFirst();
    if (!demoUser) {
      return NextResponse.json({ error: 'Demo user not found' }, { status: 500 });
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: demoUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const apiLogs = await prisma.payPalApiLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      auditLogs,
      apiLogs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch logs' }, { status: 500 });
  }
}
