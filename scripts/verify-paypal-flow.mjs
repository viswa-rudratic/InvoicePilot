// ==============================================================================
// InvoicePilot - Milestone 1 PayPal Invoicing API v2 Verification Script
// Strict Output: Print only the invoice ID, each status seen, whether
// recipient_view_url is present (and the URL itself), and the final status.
// Never print credentials.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];

  let loaded = false;
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        loaded = true;
        break;
      } catch (err) {
        console.error(`Error loading ${envPath}:`, err.message);
      }
    }
  }

  if (!loaded) {
    console.error('Error: .env file not found.');
    process.exit(1);
  }
}

loadEnv();

const PAYPAL_ENV = process.env.PAYPAL_ENV;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim();
const MERCHANT_EMAIL = process.env.PAYPAL_MERCHANT_EMAIL?.trim();
const BUYER_EMAIL = process.env.PAYPAL_BUYER_EMAIL?.trim();

// Fail-fast startup validation (never print credentials)
if (PAYPAL_ENV !== 'sandbox') {
  console.error('Error: PAYPAL_ENV must equal "sandbox".');
  process.exit(1);
}

if (!PAYPAL_BASE_URL.includes('sandbox')) {
  console.error('Error: PAYPAL_BASE_URL must contain "sandbox".');
  process.exit(1);
}

if (!CLIENT_ID || CLIENT_ID.includes('your_sandbox_client_id') ||
    !CLIENT_SECRET || CLIENT_SECRET.includes('your_sandbox_client_secret') ||
    !MERCHANT_EMAIL || !BUYER_EMAIL) {
  console.error('Error: Required PayPal sandbox credentials missing in .env.');
  process.exit(1);
}

if (CLIENT_ID === CLIENT_SECRET) {
  console.error('Error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are identical in .env.');
  console.error('In the PayPal Developer Dashboard (Apps & Credentials), click "Show" under Secret to copy your actual Client Secret.');
  process.exit(1);
}

// 2. Authenticate against PayPal OAuth 2.0
async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OAuth failure (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

// 3. Create ONE invoice to the sandbox buyer email (POST /v2/invoicing/invoices)
async function createInvoice(token) {
  const requestId = crypto.randomUUID();
  const invoiceNumber = `INV-M1-${Date.now().toString().slice(-6)}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const dueDateStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payload = {
    detail: {
      invoice_number: invoiceNumber,
      invoice_date: todayStr,
      currency_code: 'USD',
      payment_term: {
        term_type: 'DUE_ON_DATE_SPECIFIED',
        due_date: dueDateStr,
      },
      note: 'InvoicePilot Milestone 1 Verification',
    },
    invoicer: {
      email_address: MERCHANT_EMAIL,
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: BUYER_EMAIL,
        },
      },
    ],
    items: [
      {
        name: 'Milestone 1 Verification Service',
        quantity: '1',
        unit_amount: {
          currency_code: 'USD',
          value: '25.00',
        },
      },
    ],
    configuration: {
      tax_calculated_after_discount: true,
      tax_inclusive: false,
      allow_tip: false,
    },
  };

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create draft invoice (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const locationHeader = res.headers.get('location') || '';
  const invoiceHref = data.href || locationHeader;
  const invoiceId = data.id || (invoiceHref ? invoiceHref.split('/').pop() : null);
  if (!invoiceId) {
    throw new Error(`Failed to extract invoice ID from PayPal creation response.`);
  }
  return invoiceId;
}

// 4. Send the invoice (POST /v2/invoicing/invoices/{id}/send)
async function sendInvoice(token, invoiceId) {
  const requestId = crypto.randomUUID();
  const res = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify({
      send_to_recipient: true,
      send_to_invoicer: true,
    }),
  });

  if (!res.ok && res.status !== 202 && res.status !== 200) {
    const errorText = await res.text();
    throw new Error(`Failed to send invoice (HTTP ${res.status}): ${errorText}`);
  }
}

// 5. GET invoice details (GET /v2/invoicing/invoices/{id})
async function getInvoiceDetails(token, invoiceId) {
  const res = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch invoice details (HTTP ${res.status}): ${errorText}`);
  }

  return await res.json();
}

function waitForEnter(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  try {
    const token = await getAccessToken();

    // Create Draft
    const invoiceId = await createInvoice(token);
    console.log(`Invoice ID: ${invoiceId}`);
    console.log(`Status: DRAFT`);

    // Send Invoice
    await sendInvoice(token, invoiceId);
    console.log(`Status: SENT`);

    // GET invoice and inspect recipient_view_url
    const initialDetails = await getInvoiceDetails(token, invoiceId);
    const recipientViewUrl = initialDetails.detail?.metadata?.recipient_view_url ||
      initialDetails.links?.find((l) => l.rel === 'payer-view')?.href ||
      null;

    const hasRecipientUrl = !!recipientViewUrl;
    console.log(`recipient_view_url present: ${hasRecipientUrl}`);
    if (hasRecipientUrl) {
      console.log(`recipient_view_url: ${recipientViewUrl}`);
    }

    // Wait for buyer payment in private browser window and Enter keypress
    await waitForEnter('\n[Action: Pay the invoice in your browser, then press Enter to verify final status...]');

    // GET invoice again and print final status
    const finalDetails = await getInvoiceDetails(token, invoiceId);
    console.log(`Status: ${finalDetails.status}`);
    console.log(`Final status: ${finalDetails.status}`);
    process.exit(0);
  } catch (err) {
    console.error('Execution Error:', err.message);
    process.exit(1);
  }
}

main();
