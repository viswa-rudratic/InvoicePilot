import { NextRequest, NextResponse } from 'next/server';
import { runInvoiceAgent, ChatMessage } from '@/lib/agent/runner';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message string is required' }, { status: 400 });
    }

    // Authenticated demo user
    const demoUser = await prisma.user.findFirst();
    if (!demoUser) {
      return NextResponse.json({ error: 'Demo user not found. Please run seed.' }, { status: 500 });
    }

    const messages: ChatMessage[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: message });

    const result = await runInvoiceAgent({
      userId: demoUser.id,
      messages,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    logger.error('Chat API Error', err);
    return NextResponse.json(
      { error: err.message || 'Internal Agent Error' },
      { status: 500 }
    );
  }
}
