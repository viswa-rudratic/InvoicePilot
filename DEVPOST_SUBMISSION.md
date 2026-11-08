# 🏆 Devpost Submission Copy: InvoicePilot

## Project Title
**InvoicePilot**

## Tagline
The Human-Governed AI Billing Agent for Freelancers powered by Claude 3.5 Sonnet & PayPal Invoicing API v2.

---

## Inspiration
Independent freelancers and creative solopreneurs lose nearly six hours every week navigating clunky invoicing software, looking up client rates, manually calculating payment terms, and writing awkward emails chasing overdue payments.

While Large Language Models can easily turn a casual request like *"Bill Acme Corp $800 for the redesign, due in 14 days"* into structured data, directly entrusting autonomous AI with financial write privileges creates unacceptable commercial risk. Hallucinations, floating-point rounding errors, and unverified charges can destroy client trust.

We built **InvoicePilot** to deliver the conversational magic of conversational AI combined with the rock-solid trust of **PayPal Invoicing API v2**—grounded in an uncompromising **Zero-Privilege Human-in-the-Loop Governance Gate**.

---

## What It Does
**InvoicePilot** acts as an intelligent billing copilot that lives alongside a freelancer's receivables ledger:

1. **Natural Language Invoicing**: Freelancers type billing requests in plain English. The agent searches client memory for standard rates and email addresses, converts payment terms into exact due dates, and deterministically computes line item totals.
2. **Strict Approval State Machine**: Invoices are never dispatched automatically. The agent only creates proposals locked in `AWAITING_USER` status.
3. **Cryptographic SHA-256 Tamper Proofing**: Every proposal is frozen into a canonical, recursively sorted JSON snapshot and hashed with SHA-256. If a malicious script, prompt injection, or client-side tampering alters even a single cent, the backend refuses to dispatch the invoice with an HTTP 422 refusal.
4. **Live PayPal Invoicing v2 Integration**: Upon explicit one-click human approval, the backend securely dispatches the exact verified snapshot to the PayPal Invoicing API v2 (Sandbox), generating authentic hosted PayPal payment portal links (`https://www.sandbox.paypal.com/invoice/p/#...`).
5. **Deterministic Overdue Tracking & Polite Reminders**: Uses strict timezone-aware (IST) date math to flag overdue invoices, drafting customized polite or firm payment reminders that respect PayPal's 24-hour frequency rate limits (maximum 2 reminders per 24 hours).
6. **Transparent Governance Audit Drawer**: Freelancers and auditors can inspect every approval event, tamper refusal, and raw PayPal REST request ID in real time.
7. **Data Honesty Badges**: Explicitly distinguishes between **🟢 PayPal Sandbox (Live)** synchronized records and **🟣 Local Demo Records** for realistic portfolio tracking.

---

## How We Built It
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS. Clean, responsive dual-pane UI featuring real-time financial metric cards, an interactive chat stream, and an expandable receivables table.
- **AI Agent**: Anthropic Claude 3.5 Sonnet integrated via the official `@anthropic-ai/sdk`. Tool-use is strictly partitioned: the agent has read and proposal tools (`lookup_client`, `create_invoice_proposal`, `list_invoices`, `get_invoice_status`, `draft_reminder`), but zero write or money-dispatching tools.
- **Security & Approval Engine**: Custom state machine (`AWAITING_USER` $\rightarrow$ `PENDING` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `USED` / `TAMPERED`) enforcing single-use approvals, money caps, and atomic claim timeouts.
- **PayPal Integration**: Direct, pure REST communication with the PayPal Invoicing API v2 (`/v2/invoicing/invoices`, `/send`, `/remind`). Includes in-memory OAuth2 token caching and persistent `PayPal-Request-Id` idempotency headers.
- **Database & Storage**: SQLite managed via Prisma 6 ORM, storing users, client memories, proposals, invoices, approvals, audit events, and raw PayPal API logs.

---

## Challenges We Ran Into
1. **Regional Sandbox Invoicing Permissions**: In sandbox accounts created in certain regions (such as India), PayPal Invoicing API v2 returns `HTTP 403 NOT_AUTHORIZED` due to local export regulations. We resolved this by configuring a dedicated US-region sandbox business account and ensuring the "Invoicing" capability toggle was explicitly enabled in the Developer Dashboard.
2. **PayPal v2 Invoice ID Extraction**: Unlike older v1 endpoints, `POST /v2/invoicing/invoices` does not always return an `id` field at root—it returns `data.href` and a `Location` response header. We implemented an extraction pattern (`data.id || (data.href || res.headers.get('location')).split('/').pop()`) to guarantee reliable invoice ID retrieval.
3. **Canonical JSON Consistency**: Different JavaScript runtimes and JSON parsers serialize object keys in arbitrary orders. To guarantee that our SHA-256 hash would match on the server regardless of runtime differences, we built a recursive canonical JSON serializer that alphabetizes keys before hashing.
4. **Floating Point Rounding Invariants**: JavaScript floats (e.g., `0.1 + 0.2 = 0.30000000000000004`) have no place in financial applications. We enforced integer minor units (cents) across the entire system—from database schema to Zod validation.

---

## Accomplishments That We're Proud Of
- **100% Real PayPal Sandbox Integration**: We didn't mock PayPal. The app creates real PayPal drafts, dispatches authentic emails, generates real hosted payment links, and confirms payment status directly from PayPal's authoritative servers.
- **Verifiable AI Safety**: Any judge can click "Test Tamper" on a live proposal card to watch the server catch a simulated alteration, halt dispatch, lock the approval record as `TAMPERED`, and record an immutable audit entry.
- **Rock-Solid Test Coverage**: 4 comprehensive automated test suites covering 60+ test cases across unit, tool, security, and end-to-end REST workflows.
- **Deterministic AI Guardrails**: Claude handles what it does best (understanding human intent and extracting entities), while deterministic TypeScript code handles what software does best (math, dates, and cryptographic validation).

---

## What We Learned
- How to architect robust human-in-the-loop agent workflows where AI provides leverage without autonomous liability.
- The intricacies of PayPal's Invoicing v2 API, including idempotency headers, hosted payment link structures, and reminder rate limits.
- The vital importance of integer minor unit math and canonical JSON formatting in financial software.

---

## What's Next for InvoicePilot
- **Multi-Currency Conversion**: Automatic FX rate computation and multi-currency billing through PayPal's multi-currency capabilities.
- **Automated Milestone Invoicing**: Recurring contract integrations (e.g., GitHub issue completion or Figma milestone approvals triggering automated invoice proposal drafting).
- **Interactive Expense Deduction**: Scanning contractor receipts to automatically prepare itemized deductible expenses alongside receivables.

---

## Built With
- `Next.js 15`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `Prisma`
- `SQLite`
- `PayPal Invoicing API v2`
- `Anthropic Claude 3.5 Sonnet`
- `Zod`
- `Lucide Icons`
