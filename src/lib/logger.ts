// ==============================================================================
// InvoicePilot - Redacting Logger
// Redacts tokens, emails, and credentials from all system logs.
// ==============================================================================

export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '[REDACTED_EMAIL]';
  }
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `*@${domain}`;
  }
  return `${user.slice(0, 2)}***@${domain}`;
}

export function sanitizeLogString(str: string): string {
  if (!str || typeof str !== 'string') return '';
  
  return str
    // Mask Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    // Mask Basic auth
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED_AUTH]')
    // Mask email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, (match) => maskEmail(match))
    // Mask client secrets
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[REDACTED]');
}

export const logger = {
  info(message: string, meta?: unknown) {
    const sanitizedMsg = sanitizeLogString(message);
    if (meta !== undefined) {
      console.log(`[INFO] ${sanitizedMsg}`, typeof meta === 'string' ? sanitizeLogString(meta) : meta);
    } else {
      console.log(`[INFO] ${sanitizedMsg}`);
    }
  },
  warn(message: string, meta?: unknown) {
    const sanitizedMsg = sanitizeLogString(message);
    if (meta !== undefined) {
      console.warn(`[WARN] ${sanitizedMsg}`, typeof meta === 'string' ? sanitizeLogString(meta) : meta);
    } else {
      console.warn(`[WARN] ${sanitizedMsg}`);
    }
  },
  error(message: string, error?: unknown) {
    const sanitizedMsg = sanitizeLogString(message);
    const errText = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    console.error(`[ERROR] ${sanitizedMsg}`, errText ? sanitizeLogString(errText) : '');
  },
};
