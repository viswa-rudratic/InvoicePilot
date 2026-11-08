// ==============================================================================
// InvoicePilot - Query PayPal Invoice Status Script
// Usage: node scripts/check-invoice-status.mjs <INVOICE_ID>
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
      return;
    }
  }
}
loadEnv();

const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const invoiceId = process.argv[2];

if (!invoiceId) {
  console.error('Usage: node scripts/check-invoice-status.mjs <INVOICE_ID>');
  process.exit(1);
}

async function main() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const { access_token } = await tokenRes.json();

  const invRes = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoiceId}`, {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await invRes.json();
  console.log(`\nInvoice ID: ${data.id}`);
  console.log(`Status:     ${data.status}`);
  console.log(`Amount:     $${data.amount?.value} ${data.amount?.currency_code}`);
  console.log(`Due Date:   ${data.detail?.payment_term?.due_date}`);
  console.log(`Buyer URL:  ${data.detail?.metadata?.recipient_view_url}`);
}

main().catch(console.error);
