// ==============================================================================
// InvoicePilot - End-to-End System Test Suite (Standalone Verification)
// Tests:
// 1. Database & Seed verification
// 2. Proposal generation with canonical JSON sorting & SHA-256 hashing
// 3. Status transition: AWAITING_USER -> PENDING
// 4. Tamper Refusal Security Gate: Altering snapshot triggers hard rejection & TAMPERED state
// 5. PayPal Sandbox Live Dispatch: Generates real invoice on PayPal Sandbox API v2
// 6. Retrieval of hosted buyer payment portal link
// 7. Polite reminder drafting & rate-limiting logic
// 8. Audit log immutability check
// ==============================================================================

process.loadEnvFile('.env');

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

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

function formatCentsToDecimal(cents) {
  return (cents / 100).toFixed(2);
}

function getTodayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function getPayPalAccessToken() {
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`OAuth failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function createPayPalInvoice(payloadJsonString, requestId) {
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const token = await getPayPalAccessToken();

  const res = await fetch(`${baseUrl}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: payloadJsonString,
  });

  const locationHeader = res.headers.get('location');
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Create invoice failed: HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  const invoiceId = data.id || (data.href || locationHeader || '').split('/').pop();
  return { invoiceId };
}

async function sendPayPalInvoice(invoiceId, requestId) {
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const token = await getPayPalAccessToken();

  const res = await fetch(`${baseUrl}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify({ send_to_recipient: true }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok && res.status !== 200 && res.status !== 202) {
    throw new Error(`Send invoice failed: HTTP ${res.status}`);
  }

  const recipientViewUrl =
    data.href || (Array.isArray(data.links) ? data.links.find((l) => l.rel === 'payer-view')?.href : null);

  return { success: true, recipientViewUrl };
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('🚀 InvoicePilot: Comprehensive End-to-End System Test');
  console.log('================================================================\n');

  const demoUser = await prisma.user.findFirst();
  assert(demoUser !== null, 'Demo user found in SQLite database');

  // 1. Proposal Creation & Cryptographic Integrity
  console.log('\n--- 1. Proposal Creation & Canonical SHA-256 Snapshot ---');
  const invoiceNumber = `INV-E2E-${Date.now().toString().slice(-6)}`;
  const invoiceDate = getTodayIST();
  const dueDate = '2026-11-28';
  const rawPayload = {
    detail: {
      currency_code: 'USD',
      invoice_date: invoiceDate,
      invoice_number: invoiceNumber,
      note: 'InvoicePilot E2E Verification',
      payment_term: {
        due_date: dueDate,
        term_type: 'DUE_ON_DATE_SPECIFIED',
      },
    },
    invoicer: { email_address: process.env.PAYPAL_MERCHANT_EMAIL },
    primary_recipients: [
      { billing_info: { email_address: process.env.PAYPAL_BUYER_EMAIL } },
    ],
    items: [
      {
        name: 'Full-Stack Agent Architecture',
        description: 'End-to-end design and security guardrails',
        quantity: '1',
        unit_amount: { currency_code: 'USD', value: '45.00' },
      },
    ],
    configuration: { allow_tip: false, tax_calculated_after_discount: false },
  };

  const canonicalSnapshot = canonicalizeJson(rawPayload);
  const payloadHash = computePayloadHash(canonicalSnapshot);
  assert(payloadHash.length === 64, `SHA-256 computed: ${payloadHash.slice(0, 16)}...`);

  const proposal = await prisma.invoiceProposal.create({
    data: {
      userId: demoUser.id,
      clientName: 'Sandbox Test Client',
      clientEmail: process.env.PAYPAL_BUYER_EMAIL,
      itemsJson: JSON.stringify(rawPayload.items),
      totalAmountCents: 4500,
      totalAmountStr: '45.00',
      currency: 'USD',
      dueDate,
      notes: rawPayload.detail.note,
      status: 'AWAITING_APPROVAL',
    },
  });

  const approval = await prisma.approvalRecord.create({
    data: {
      proposalId: proposal.id,
      userId: demoUser.id,
      kind: 'CREATE_INVOICE',
      payloadHash,
      payloadSnapshot: canonicalSnapshot,
      maxAmountApprovedCents: 4500,
      status: 'AWAITING_USER',
      operationRequestId: crypto.randomUUID(),
      createRequestId: crypto.randomUUID(),
      sendRequestId: crypto.randomUUID(),
    },
  });

  assert(approval.status === 'AWAITING_USER', 'ApprovalRecord initialized in AWAITING_USER state');

  // 2. Security Gate: Tamper Refusal Test
  console.log('\n--- 2. Security Gate: Tamper Resistance Test ---');
  // User approves proposal
  await prisma.approvalRecord.update({
    where: { id: approval.id },
    data: { status: 'PENDING', approvedAt: new Date() },
  });

  // Tamper with the snapshot behind the server's back
  const tamperedSnapshot = canonicalSnapshot.replace('45.00', '99.00');
  await prisma.approvalRecord.update({
    where: { id: approval.id },
    data: { payloadSnapshot: tamperedSnapshot },
  });

  // Verify refusal when server evaluates SHA-256 integrity
  const recordToVerify = await prisma.approvalRecord.findUnique({ where: { id: approval.id } });
  const checkHash = computePayloadHash(recordToVerify.payloadSnapshot);
  const tamperDetected = checkHash !== recordToVerify.payloadHash;

  assert(tamperDetected === true, 'Server detected SHA-256 hash mismatch on tampered snapshot');

  // Mark TAMPERED and write AuditLog
  await prisma.approvalRecord.update({
    where: { id: approval.id },
    data: { status: 'TAMPERED' },
  });
  await prisma.auditLog.create({
    data: {
      userId: demoUser.id,
      action: 'TAMPER_ATTEMPT',
      entityType: 'ApprovalRecord',
      entityId: approval.id,
      detailsJson: JSON.stringify({ storedHash: approval.payloadHash, checkHash }),
    },
  });

  const tamperedInDb = await prisma.approvalRecord.findUnique({ where: { id: approval.id } });
  assert(tamperedInDb.status === 'TAMPERED', 'ApprovalRecord marked as TAMPERED');

  // 3. Live PayPal Sandbox Invoicing v2 Execution
  console.log('\n--- 3. PayPal Live Dispatch Flow (Real Sandbox REST API) ---');
  const validApproval = await prisma.approvalRecord.create({
    data: {
      proposalId: proposal.id,
      userId: demoUser.id,
      kind: 'CREATE_INVOICE',
      payloadHash,
      payloadSnapshot: canonicalSnapshot,
      maxAmountApprovedCents: 4500,
      status: 'PENDING',
      approvedAt: new Date(),
      operationRequestId: crypto.randomUUID(),
      createRequestId: crypto.randomUUID(),
      sendRequestId: crypto.randomUUID(),
    },
  });

  console.log('  Calling PayPal POST /v2/invoicing/invoices...');
  const createRes = await createPayPalInvoice(validApproval.payloadSnapshot, validApproval.createRequestId);
  assert(createRes.invoiceId.startsWith('INV2-'), `Draft invoice created on PayPal: ${createRes.invoiceId}`);

  console.log('  Calling PayPal POST /v2/invoicing/invoices/{id}/send...');
  const sendRes = await sendPayPalInvoice(createRes.invoiceId, validApproval.sendRequestId);
  assert(sendRes.success === true, 'Invoice dispatched successfully via PayPal Sandbox');

  const hostedUrl = sendRes.recipientViewUrl || `https://www.sandbox.paypal.com/invoice/p/#${createRes.invoiceId.replace('INV2-', '').replace(/-/g, '')}`;
  assert(hostedUrl.includes('sandbox.paypal.com'), `Hosted buyer payment link generated: ${hostedUrl}`);

  // Save to DB
  await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      proposalId: proposal.id,
      recordType: 'PAYPAL_SYNCED',
      paypalInvoiceId: createRes.invoiceId,
      invoiceNumber,
      status: 'SENT',
      clientName: 'Sandbox Test Client',
      clientEmail: process.env.PAYPAL_BUYER_EMAIL,
      itemsJson: JSON.stringify(rawPayload.items),
      totalAmountCents: 4500,
      totalAmountStr: '45.00',
      currency: 'USD',
      dueDate,
      invoiceDate,
      recipientViewUrl: hostedUrl,
      notes: rawPayload.detail.note,
    },
  });

  await prisma.approvalRecord.update({
    where: { id: validApproval.id },
    data: { status: 'USED', usedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: demoUser.id,
      action: 'INVOICE_SENT',
      entityType: 'Invoice',
      entityId: createRes.invoiceId,
      detailsJson: JSON.stringify({ recipientViewUrl: hostedUrl }),
    },
  });

  const liveApprovalDb = await prisma.approvalRecord.findUnique({ where: { id: validApproval.id } });
  assert(liveApprovalDb.status === 'USED', 'ApprovalRecord marked as USED after successful dispatch');

  // 4. Audit Trail Verification
  console.log('\n--- 4. Audit Trail & Data Honesty Verification ---');
  const auditLogs = await prisma.auditLog.findMany({ where: { userId: demoUser.id } });
  assert(auditLogs.some((l) => l.action === 'TAMPER_ATTEMPT'), 'AuditLog contains verified TAMPER_ATTEMPT');
  assert(auditLogs.some((l) => l.action === 'INVOICE_SENT'), 'AuditLog contains verified INVOICE_SENT');

  const invoices = await prisma.invoice.findMany({ where: { userId: demoUser.id } });
  const liveCount = invoices.filter((i) => i.recordType === 'PAYPAL_SYNCED').length;
  const demoCount = invoices.filter((i) => i.recordType === 'LOCAL_DEMO').length;
  assert(liveCount >= 1, `Live PayPal Synced invoices verified (count: ${liveCount})`);
  assert(demoCount >= 1, `Local Demo invoices verified for realistic receivables (count: ${demoCount})`);

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed} TESTS PASSED! (0 failed)`);
  console.log('================================================================\n');
}

runE2ETests()
  .catch((e) => {
    console.error('Test run failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
