// ==============================================================================
// InvoicePilot - PayPal Invoicing API v2 Service Layer
// Verified against official PayPal Developer Documentation.
// SANDBOX ONLY. Credentials strictly read from process.env.
// ==============================================================================

import { logger, sanitizeLogString } from './logger';
import { prisma } from './db';

// Fail-fast environment validation
function validateConfig() {
  const env = process.env.PAYPAL_ENV;
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

  if (env !== 'sandbox') {
    throw new Error('SECURITY HALT: PAYPAL_ENV must equal "sandbox". Live payments are prohibited.');
  }

  if (!baseUrl.includes('sandbox')) {
    throw new Error('SECURITY HALT: PAYPAL_BASE_URL must contain "sandbox". Live payments are prohibited.');
  }

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const merchantEmail = process.env.PAYPAL_MERCHANT_EMAIL?.trim();

  if (!clientId || !clientSecret || !merchantEmail) {
    throw new Error('Missing required PayPal credentials in environment.');
  }

  return { baseUrl, clientId, clientSecret, merchantEmail };
}

// In-memory OAuth2 token cache
interface CachedToken {
  accessToken: string;
  expiresAt: number; // unix timestamp in ms
}

let cachedToken: CachedToken | null = null;

/**
 * Retrieves a valid OAuth2 Bearer token, reusing cached token if within validity window.
 */
export async function getPayPalAccessToken(): Promise<string> {
  const { baseUrl, clientId, clientSecret } = validateConfig();

  // Re-use token if valid for at least another 5 minutes
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const startTime = Date.now();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const durationMs = Date.now() - startTime;

  if (!res.ok) {
    const errorText = await res.text();
    logger.error(`PayPal OAuth failed (HTTP ${res.status})`, errorText);
    throw new Error(`PayPal OAuth failed (HTTP ${res.status}): ${sanitizeLogString(errorText)}`);
  }

  const data = await res.json();
  const expiresInSeconds = typeof data.expires_in === 'number' ? data.expires_in : 3600;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + expiresInSeconds * 1000,
  };

  logger.info(`PayPal OAuth token refreshed successfully (valid for ${expiresInSeconds}s)`);
  return cachedToken.accessToken;
}

/**
 * Helper to log PayPal API call to database
 */
async function logApiCall(
  endpoint: string,
  method: string,
  requestId: string,
  statusCode: number,
  durationMs: number,
  errorMessage?: string
) {
  try {
    await prisma.payPalApiLog.create({
      data: {
        endpoint,
        method,
        requestId,
        statusCode,
        durationMs,
        errorMessage: errorMessage ? sanitizeLogString(errorMessage) : null,
      },
    });
  } catch (err) {
    logger.warn('Failed to record PayPalApiLog in database', err);
  }
}

/**
 * Step 1: Create a draft invoice on PayPal
 * Uses exact approved payload string without re-serializing.
 */
export async function createPayPalInvoice(
  payloadString: string,
  requestId: string
): Promise<{ invoiceId: string; rawResponse: unknown }> {
  const { baseUrl } = validateConfig();
  const token = await getPayPalAccessToken();
  const endpoint = `${baseUrl}/v2/invoicing/invoices`;
  const startTime = Date.now();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: payloadString,
  });

  const durationMs = Date.now() - startTime;
  const status = res.status;

  if (!res.ok) {
    const errorText = await res.text();
    await logApiCall('/v2/invoicing/invoices', 'POST', requestId, status, durationMs, errorText);
    throw new Error(`PayPal invoice creation failed (HTTP ${status}): ${sanitizeLogString(errorText)}`);
  }

  const data = await res.json();
  await logApiCall('/v2/invoicing/invoices', 'POST', requestId, status, durationMs);

  // In PayPal v2, invoice id is either data.id or the last path segment of the resource URL
  const locationHeader = res.headers.get('location') || '';
  const invoiceHref = (data as { href?: string }).href || locationHeader;
  const invoiceId = (data as { id?: string }).id || (invoiceHref ? invoiceHref.split('/').pop() : null);

  if (!invoiceId) {
    throw new Error('PayPal invoice created but could not determine invoice ID from response.');
  }

  logger.info(`Draft invoice created on PayPal: ${invoiceId}`);
  return { invoiceId, rawResponse: data };
}

/**
 * Step 2: Send invoice to recipient
 */
export async function sendPayPalInvoice(
  invoiceId: string,
  requestId: string
): Promise<{ success: boolean; recipientViewUrl?: string; rawResponse: unknown }> {
  const { baseUrl } = validateConfig();
  const token = await getPayPalAccessToken();
  const endpoint = `${baseUrl}/v2/invoicing/invoices/${invoiceId}/send`;
  const startTime = Date.now();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify({
      send_to_recipient: true,
      send_to_invoicer: true,
    }),
  });

  const durationMs = Date.now() - startTime;
  const status = res.status;

  if (!res.ok && status !== 200 && status !== 202) {
    const errorText = await res.text();
    await logApiCall(`/v2/invoicing/invoices/${invoiceId}/send`, 'POST', requestId, status, durationMs, errorText);
    throw new Error(`PayPal send invoice failed (HTTP ${status}): ${sanitizeLogString(errorText)}`);
  }

  const data = await res.json().catch(() => ({}));
  await logApiCall(`/v2/invoicing/invoices/${invoiceId}/send`, 'POST', requestId, status, durationMs);

  // Extract recipient view URL if returned in send response
  const recipientViewUrl = (data as { href?: string }).href;
  logger.info(`Invoice dispatched on PayPal: ${invoiceId}`);
  return { success: true, recipientViewUrl, rawResponse: data };
}

/**
 * Step 3: Fetch full invoice details from PayPal
 */
export async function getPayPalInvoice(invoiceId: string): Promise<any> {
  const { baseUrl } = validateConfig();
  const token = await getPayPalAccessToken();
  const endpoint = `${baseUrl}/v2/invoicing/invoices/${invoiceId}`;
  const startTime = Date.now();
  const dummyRequestId = `get-${invoiceId}-${Date.now()}`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const durationMs = Date.now() - startTime;
  const status = res.status;

  if (!res.ok) {
    const errorText = await res.text();
    await logApiCall(`/v2/invoicing/invoices/${invoiceId}`, 'GET', dummyRequestId, status, durationMs, errorText);
    throw new Error(`PayPal get invoice failed (HTTP ${status}): ${sanitizeLogString(errorText)}`);
  }

  const data = await res.json();
  await logApiCall(`/v2/invoicing/invoices/${invoiceId}`, 'GET', dummyRequestId, status, durationMs);
  return data;
}

/**
 * Step 4: List invoices from PayPal with pagination
 */
export async function listPayPalInvoices(page = 1, pageSize = 20): Promise<any> {
  const { baseUrl } = validateConfig();
  const token = await getPayPalAccessToken();
  const endpoint = `${baseUrl}/v2/invoicing/invoices?page=${page}&page_size=${pageSize}&total_required=true`;
  const startTime = Date.now();
  const dummyRequestId = `list-${Date.now()}`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const durationMs = Date.now() - startTime;
  const status = res.status;

  if (!res.ok) {
    const errorText = await res.text();
    await logApiCall('/v2/invoicing/invoices', 'GET', dummyRequestId, status, durationMs, errorText);
    throw new Error(`PayPal list invoices failed (HTTP ${status}): ${sanitizeLogString(errorText)}`);
  }

  const data = await res.json();
  await logApiCall('/v2/invoicing/invoices', 'GET', dummyRequestId, status, durationMs);
  return data;
}

/**
 * Step 5: Send reminder for an invoice
 * Handles 2-reminder-per-24h rate limit gracefully.
 */
export async function remindPayPalInvoice(
  invoiceId: string,
  subject: string,
  note: string,
  requestId: string
): Promise<{ success: boolean; rawResponse: unknown }> {
  const { baseUrl } = validateConfig();
  const token = await getPayPalAccessToken();
  const endpoint = `${baseUrl}/v2/invoicing/invoices/${invoiceId}/remind`;
  const startTime = Date.now();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify({
      notification: {
        subject,
        note,
        send_to_invoicer: true,
        send_to_recipient: true,
      },
    }),
  });

  const durationMs = Date.now() - startTime;
  const status = res.status;

  if (!res.ok && status !== 200 && status !== 204) {
    const errorText = await res.text();
    await logApiCall(`/v2/invoicing/invoices/${invoiceId}/remind`, 'POST', requestId, status, durationMs, errorText);

    // Graceful handling of PayPal reminder frequency limitation (max 2 per 24 hours)
    if (status === 422 || errorText.includes('MAX_NUMBER_OF_REMINDERS_EXCEEDED') || errorText.includes('FREQUENCY_LIMIT')) {
      throw new Error('PayPal Rate Limit: Maximum reminder limit reached (max 2 manual reminders per 24 hours). Please wait before reminding again.');
    }

    throw new Error(`PayPal reminder failed (HTTP ${status}): ${sanitizeLogString(errorText)}`);
  }

  const data = await res.json().catch(() => ({}));
  await logApiCall(`/v2/invoicing/invoices/${invoiceId}/remind`, 'POST', requestId, status, durationMs);

  logger.info(`Reminder dispatched on PayPal for invoice: ${invoiceId}`);
  return { success: true, rawResponse: data };
}
