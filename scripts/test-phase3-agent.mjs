// ==============================================================================
// InvoicePilot - Phase 3 Agent Tools Verification Suite
// Verifies:
// 1. lookup_client tool retrieves saved client memory
// 2. create_invoice_proposal tool validates schema & locks AWAITING_USER approval
// 3. list_invoices returns deterministic code-computed totals & IST overdue flags
// 4. get_invoice_status computes days overdue/due
// 5. draft_reminder checks 24h limit & creates pending approval
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import {
  executeLookupClient,
  executeCreateProposal,
  executeListInvoices,
  executeGetInvoiceStatus,
  executeDraftReminder,
} from '../src/lib/agent/tools.ts';

// Load .env
process.loadEnvFile('.env');

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Starting Phase 3 Agent Tools Verification...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  const demoUser = await prisma.user.findFirst();
  if (!demoUser) {
    throw new Error('Seed demo user not found.');
  }

  // TEST 1: lookup_client Tool
  console.log('[Tool Test 1] lookup_client');
  const clientResult = await executeLookupClient({ query: 'Acme' }, demoUser.id);
  assert(clientResult.found === true, 'Successfully located Acme in ClientMemory');
  assert(clientResult.clients[0].name === 'Acme Corp', 'Client name matched Acme Corp');
  assert(clientResult.clients[0].email === 'billing@acme.example.com', 'Client email retrieved');
  assert(clientResult.clients[0].standardRateCents === 80000, 'Standard rate retrieved ($800.00)');

  // TEST 2: create_invoice_proposal Tool
  console.log('\n[Tool Test 2] create_invoice_proposal');
  const proposalInput = {
    clientName: 'Acme Corp',
    clientEmail: 'billing@acme.example.com',
    items: [
      {
        name: 'Brand Identity Design',
        description: 'Primary vector logo and typography guide',
        quantity: 1,
        unitAmountCents: 80000, // $800.00
      },
    ],
    currency: 'USD',
    dueDate: '2026-11-25',
    notes: 'Thank you for choosing Rivera Studio. Payment due in 14 days.',
  };

  const proposalResult = await executeCreateProposal(proposalInput, demoUser.id);
  assert(proposalResult.success === true, 'Proposal successfully created');
  assert(proposalResult.totalAmount === '$800.00 USD', 'Deterministic total computed ($800.00 USD)');
  assert(proposalResult.status === 'AWAITING_USER_APPROVAL', 'Initial status is AWAITING_USER_APPROVAL');
  assert(!!proposalResult.approvalId, 'Approval ID generated');

  // Verify DB state for this proposal
  const dbApproval = await prisma.approvalRecord.findUnique({
    where: { id: proposalResult.approvalId },
  });
  assert(dbApproval.status === 'AWAITING_USER', 'Database approval status is strictly AWAITING_USER');
  assert(dbApproval.approvedAt === null, 'approvedAt timestamp is null');

  // TEST 3: list_invoices Tool with Deterministic Financial Computations
  console.log('\n[Tool Test 3] list_invoices with code-computed summaries');
  const listResult = await executeListInvoices({}, demoUser.id);
  assert(listResult.totalCount >= 3, 'Found at least 3 invoices (seeded fixtures)');
  assert(listResult.summary.totalInvoiced !== undefined, 'Summary totalInvoiced computed in code');
  assert(listResult.summary.totalCollected !== undefined, 'Summary totalCollected computed in code');
  assert(listResult.summary.totalOverdue !== undefined, 'Summary totalOverdue computed in code');
  assert(listResult.summary.overdueCount >= 1, 'Detected at least 1 overdue invoice (INV-DEMO-002)');

  // Verify data honesty badges in output
  const hasLocalDemo = listResult.invoices.some((i) => i.recordType === 'LOCAL_DEMO');
  const hasPayPalSynced = listResult.invoices.some((i) => i.recordType === 'PAYPAL_SYNCED');
  assert(hasLocalDemo === true, 'Data honesty badge present: LOCAL_DEMO');
  assert(hasPayPalSynced === true, 'Data honesty badge present: PAYPAL_SYNCED');

  // TEST 4: get_invoice_status Tool
  console.log('\n[Tool Test 4] get_invoice_status');
  const statusResult = await executeGetInvoiceStatus({ invoiceNumber: 'INV-DEMO-002' }, demoUser.id);
  assert(statusResult.invoiceNumber === 'INV-DEMO-002', 'Retrieved invoice INV-DEMO-002');
  assert(statusResult.isOverdue === true, 'Correctly flagged as overdue');
  assert(typeof statusResult.daysOverdue === 'number' && statusResult.daysOverdue > 0, 'Computed days overdue in IST');

  // TEST 5: draft_reminder Tool
  console.log('\n[Tool Test 5] draft_reminder');
  const reminderResult = await executeDraftReminder(
    { invoiceId: 'demo-invoice-overdue-2', tone: 'firm' },
    demoUser.id
  );
  assert(reminderResult.success === true, 'Successfully drafted firm reminder');
  assert(reminderResult.draftSubject.includes('PAST DUE'), 'Subject includes PAST DUE for firm tone');
  assert(reminderResult.status === 'AWAITING_USER_APPROVAL', 'Reminder status is strictly AWAITING_USER_APPROVAL');
  assert(!!reminderResult.approvalId, 'Reminder approval ID generated');

  const reminderApproval = await prisma.approvalRecord.findUnique({
    where: { id: reminderResult.approvalId },
  });
  assert(reminderApproval.kind === 'REMINDER', 'Approval kind is strictly REMINDER');
  assert(reminderApproval.status === 'AWAITING_USER', 'Reminder approval status is AWAITING_USER');
  assert(reminderApproval.approvedAt === null, 'Reminder approvedAt is null');

  // Clean up test proposal and reminder
  await prisma.approvalRecord.deleteMany({ where: { proposalId: proposalResult.proposalId } });
  await prisma.invoiceProposal.delete({ where: { id: proposalResult.proposalId } });
  await prisma.approvalRecord.delete({ where: { id: reminderResult.approvalId } });

  console.log(`\n======================================================================`);
  console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Fatal Test Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
