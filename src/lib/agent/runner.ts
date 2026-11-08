// ==============================================================================
// InvoicePilot - Anthropic Claude Agent Runner
// Powered by Anthropic Claude SDK with Structured Tool Use.
// Enforces human-in-the-loop safety & zero automated money movement.
// ==============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger';
import {
  ANTHROPIC_TOOLS,
  executeLookupClient,
  executeCreateProposal,
  executeListInvoices,
  executeGetInvoiceStatus,
  executeDraftReminder,
} from './tools';

const SYSTEM_PROMPT = `You are InvoicePilot, a senior AI financial and invoicing assistant for freelancers, particularly international freelancers billing clients worldwide.

YOUR PRINCIPLES & HARD RULES:
1. ZERO MONEY-MOVEMENT PRIVILEGES:
   - You can ONLY draft invoice proposals and reminder texts.
   - You CANNOT send invoices or reminders directly to clients or to PayPal.
   - Every invoice proposal and reminder you create enters an "AWAITING_USER" state and requires the user to explicitly review and click Approve. Always inform the user that their explicit approval is required before anything is dispatched.

2. FINANCIAL HONESTY & CODE-COMPUTED NUMBERS:
   - Financial numbers (totals, unpaid amounts, days overdue, aging summaries) are computed strictly by backend code in your tool responses.
   - NEVER invent, hallucinate, or estimate financial numbers. Only cite and explain figures returned by your tools.

3. MISSING INFORMATION & CLARIFICATION:
   - When a user asks to invoice someone (e.g., "Invoice Acme Corp $800 for logo design, due in 14 days"):
     a) FIRST call the "lookup_client" tool to check if the client's email and standard rate are saved in Client Memory.
     b) If the client's email is found in memory, proceed to call "create_invoice_proposal".
     c) If the client email is NOT found or missing, ASK the user for their email address. NEVER invent an email address.
   - Calculate due dates based on the current date in IST. For example, "due in 14 days" should be calculated from today.

4. LATE FEES:
   - If the user asks to add a late fee or penalty, treat it ONLY as a polite note or payment term in the invoice notes. NEVER add it as an automatic surcharge or extra line item without explicit instruction.

5. DATA HONESTY:
   - When answering questions about invoices, distinguish clearly between PayPal-synchronized invoices (verified Sandbox invoices) and local demo records.

Tone: Professional, concise, reassuring, and precise.
`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentRunResult {
  reply: string;
  proposal?: any;
  reminder?: any;
  toolsCalled: string[];
}

function getAnthropicClient(): { client: Anthropic; model: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.ANTHROPIC_MODEL?.trim();

  if (!apiKey || apiKey.includes('your_anthropic')) {
    throw new Error('ANTHROPIC_API_KEY is missing or invalid in environment (.env).');
  }

  if (!model) {
    throw new Error('SECURITY HALT: ANTHROPIC_MODEL is strictly required in .env with no fallback.');
  }

  return {
    client: new Anthropic({ apiKey }),
    model,
  };
}

export async function runInvoiceAgent(params: {
  userId: string;
  messages: ChatMessage[];
}): Promise<AgentRunResult> {
  const { client, model } = getAnthropicClient();
  const toolsCalled: string[] = [];
  let generatedProposal: any = null;
  let generatedReminder: any = null;

  // Format messages for Anthropic API
  const conversationMessages: Anthropic.MessageParam[] = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const maxTurns = 5;
  let turns = 0;

  while (turns < maxTurns) {
    turns++;

    const response = await client.messages.create({
      model,
      system: SYSTEM_PROMPT,
      messages: conversationMessages,
      tools: ANTHROPIC_TOOLS as any,
      max_tokens: 2048,
    });

    // Check for tool calls
    const toolUseBlocks = response.content.filter(
      (b) => b.type === 'tool_use'
    ) as Anthropic.ToolUseBlock[];

    if (toolUseBlocks.length === 0) {
      // Terminal text response
      const textBlock = response.content.find((b) => b.type === 'text');
      const reply = textBlock ? (textBlock as Anthropic.TextBlock).text : '';

      return {
        reply,
        proposal: generatedProposal,
        reminder: generatedReminder,
        toolsCalled,
      };
    }

    // Append assistant's response (with tool calls) to message history
    conversationMessages.push({
      role: 'assistant',
      content: response.content,
    });

    // Execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      toolsCalled.push(toolUse.name);
      logger.info(`Agent executing tool: ${toolUse.name}`);
      let output: unknown;

      try {
        switch (toolUse.name) {
          case 'lookup_client':
            output = await executeLookupClient(toolUse.input as any, params.userId);
            break;

          case 'create_invoice_proposal':
            output = await executeCreateProposal(toolUse.input, params.userId);
            if ((output as any)?.success) {
              generatedProposal = output;
            }
            break;

          case 'list_invoices':
            output = await executeListInvoices(toolUse.input as any, params.userId);
            break;

          case 'get_invoice_status':
            output = await executeGetInvoiceStatus(toolUse.input as any, params.userId);
            break;

          case 'draft_reminder':
            output = await executeDraftReminder(toolUse.input as any, params.userId);
            if ((output as any)?.success) {
              generatedReminder = output;
            }
            break;

          default:
            output = { error: `Unknown tool: ${toolUse.name}` };
        }
      } catch (toolErr) {
        output = {
          error: toolErr instanceof Error ? toolErr.message : 'Tool execution error',
        };
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(output),
      });
    }

    // Append tool results to message history
    conversationMessages.push({
      role: 'user',
      content: toolResults,
    });
  }

  return {
    reply: 'Reached maximum conversation tool turns.',
    proposal: generatedProposal,
    reminder: generatedReminder,
    toolsCalled,
  };
}
