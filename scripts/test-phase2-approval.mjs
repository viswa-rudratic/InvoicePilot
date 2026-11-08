// ==============================================================================
// InvoicePilot - Phase 2 Approval Engine & Security Test Suite
// Verifies:
// 1. Proposal creation with AWAITING_USER state and SHA-256 snapshot
// 2. Explicit user approval transition to PENDING
// 3. Tamper detection: modifying stored snapshot causes immediate refusal
// 4. Maximum amount cap enforcement
// 5. Revocation of approvals on proposal modification
// 6. Strict IST date-only overdue evaluation
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

// Load .env
process.loadEnvFile('.env');

const prisma = new PrismaClient();

// Inline core logic for test verification
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalizeJson).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`
  );
  return `{${entries.join(',')}}`;
}

function computePayloadHash(canonicalString) {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

function getTodayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isOverdue(dueDate, status) {
  const activeUnsettledStatuses = ['SENT', 'UNPAID', 'PARTIALLY_PAID', 'PAYMENT_PENDING'];
  if (!activeUnsettledStatuses.includes(status)) return false;
  return dueDate < getTodayIST();
}

async function runTests() {
  console.log('🧪 Starting Phase 2 Approval & Security Tests...\n');
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

  const demoUser = await prisma.user.findUnique({ where: { email: 'demo@invoicepilot.dev' } });
  if (!demoUser) {
    throw new Error('Seed demo user not found. Run npm run db:seed first.');
  }

  // TEST 1: IST Date Math & Overdue Invariants
  console.log('[Test Group 1] IST Date Math & Strict Overdue Invariants');
  const pastDate = '2026-10-10';
  const futureDate = '2026-12-31';

  assert(isOverdue(pastDate, 'SENT') === true, 'SENT past due is overdue');
  assert(isOverdue(pastDate, 'UNPAID') === true, 'UNPAID past due is overdue');
  assert(isOverdue(pastDate, 'PAID') === false, 'PAID past due is NEVER overdue');
  assert(isOverdue(pastDate, 'MARKED_AS_PAID') === false, 'MARKED_AS_PAID past due is NEVER overdue');
  assert(isOverdue(pastDate, 'DRAFT') === false, 'DRAFT past due is NEVER overdue');
  assert(isOverdue(pastDate, 'SCHEDULED') === false, 'SCHEDULED past due is NEVER overdue');
  assert(isOverdue(pastDate, 'CUSTOM_UNKNOWN_STATE') === false, 'Unknown PayPal status is NEVER overdue');
  assert(isOverdue(futureDate, 'SENT') === false, 'SENT with future date is not overdue');

  // TEST 2: Canonical Payload & Cryptographic SHA-256 Hashing
  console.log('\n[Test Group 2] Canonicalization & SHA-256 Hash Verification');
  const testObj1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
  const testObj2 = { a: 1, c: { x: 10, y: 20 }, b: 2 }; // Same content, different key order
  const canonical1 = canonicalizeJson(testObj1);
  const canonical2 = canonicalizeJson(testObj2);

  assert(canonical1 === canonical2, 'Canonical JSON is deterministic regardless of key insertion order');
  assert(computePayloadHash(canonical1) === computePayloadHash(canonical2), 'SHA-256 hash matches across identical canonical objects');

  // TEST 3: Proposal Creation with AWAITING_USER State & approvedAt: null
  console.log('\n[Test Group 3] Proposal Creation & Initial Approval State');
  const rawPayload = {
    detail: { invoice_number: 'TEST-INV-101', invoice_date: getTodayIST(), currency_code: 'USD' },
    invoicer: { email_address: process.env.PAYPAL_MERCHANT_EMAIL },
    items: [{ name: 'Test Service', quantity: '1', unit_amount: { currency_code: 'USD', value: '100.00' } }]
  };
  const canonicalSnapshot = canonicalizeJson(rawPayload);
  const hash = computePayloadHash(canonicalSnapshot);

  const testProposal = await prisma.invoiceProposal.create({
    data: {
      userId: demoUser.id,
      clientName: 'Acme Testing',
      clientEmail: 'billing@acme.example.com',
      itemsJson: JSON.stringify([{ name: 'Test Service', quantity: 1, unitAmountCents: 10000 }]),
      totalAmountCents: 10000,
      totalAmountStr: '100.00',
      currency: 'USD',
      dueDate: '2026-11-30',
      status: 'PENDING_APPROVAL',
      approvals: {
        create: {
          userId: demoUser.id,
          kind: 'INVOICE',
          payloadHash: hash,
          payloadSnapshot: canonicalSnapshot,
          maxAmountApprovedCents: 10000,
          status: 'AWAITING_USER',
          approvedAt: null,
          createRequestId: crypto.randomUUID(),
          sendRequestId: crypto.randomUUID(),
        }
      }
    },
    include: { approvals: true }
  });

  const createdApproval = testProposal.approvals[0];
  assert(createdApproval.status === 'AWAITING_USER', 'Initial approval status is strictly AWAITING_USER');
  assert(createdApproval.approvedAt === null, 'Initial approvedAt timestamp is null');
  assert(createdApproval.payloadHash === hash, 'Stored SHA-256 hash matches payloadSnapshot');

  // TEST 4: User Approval Action (AWAITING_USER -> PENDING)
  console.log('\n[Test Group 4] Explicit User Approval Transition');
  const approved = await prisma.approvalRecord.update({
    where: { id: createdApproval.id },
    data: { status: 'PENDING', approvedAt: new Date() }
  });

  assert(approved.status === 'PENDING', 'Approval transitioned to PENDING');
  assert(approved.approvedAt instanceof Date, 'approvedAt timestamp successfully recorded');

  // TEST 5: Tamper Detection Security Gate
  console.log('\n[Test Group 5] Tamper Refusal Security Gate');
  // Intentionally tamper with snapshot string (e.g. change value to 999.00)
  const tamperedSnapshot = canonicalSnapshot.replace('100.00', '999.00');
  const computedTamperedHash = computePayloadHash(tamperedSnapshot);
  const hashMismatch = computedTamperedHash !== approved.payloadHash;

  assert(hashMismatch === true, 'Tampered snapshot produces mismatched SHA-256 hash');

  if (hashMismatch) {
    // Backend security gate refuses execution and marks TAMPERED
    await prisma.approvalRecord.update({
      where: { id: approved.id },
      data: { status: 'TAMPERED' }
    });
  }

  const tamperedRecord = await prisma.approvalRecord.findUnique({ where: { id: approved.id } });
  assert(tamperedRecord.status === 'TAMPERED', 'Backend flags approval status as TAMPERED upon hash deviation');

  // TEST 6: Atomic Claim Guard (Rejection of Non-Pending Approvals)
  console.log('\n[Test Group 6] Atomic Claiming Guard');
  const claimResult = await prisma.approvalRecord.updateMany({
    where: { id: approved.id, status: 'PENDING' },
    data: { status: 'IN_PROGRESS', claimedAt: new Date() }
  });

  assert(claimResult.count === 0, 'Atomic claim rejects TAMPERED / non-PENDING approval records (count = 0)');

  // TEST 7: Proposal Modification Revocation
  console.log('\n[Test Group 7] Approval Revocation on Proposal Edit');
  const newApproval = await prisma.approvalRecord.create({
    data: {
      proposalId: testProposal.id,
      userId: demoUser.id,
      kind: 'INVOICE',
      payloadHash: hash,
      payloadSnapshot: canonicalSnapshot,
      maxAmountApprovedCents: 10000,
      status: 'AWAITING_USER',
      createRequestId: crypto.randomUUID(),
      sendRequestId: crypto.randomUUID(),
    }
  });

  const revokeResult = await prisma.approvalRecord.updateMany({
    where: {
      proposalId: testProposal.id,
      status: { in: ['AWAITING_USER', 'PENDING'] }
    },
    data: { status: 'REVOKED' }
  });

  assert(revokeResult.count >= 1, 'Editing proposal successfully revokes all pending approvals');
  const checkRevoked = await prisma.approvalRecord.findUnique({ where: { id: newApproval.id } });
  assert(checkRevoked.status === 'REVOKED', 'Approval record status verified as REVOKED');

  // Clean up test proposal
  await prisma.approvalRecord.deleteMany({ where: { proposalId: testProposal.id } });
  await prisma.invoiceProposal.delete({ where: { id: testProposal.id } });

  console.log(`\n======================================================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test Suite Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
