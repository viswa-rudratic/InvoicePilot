# 🎬 InvoicePilot: 2-Minute Demo Video Script
**Target Duration:** 1 minute 55 seconds  
**Theme:** "Speed of AI, Safety of PayPal, Sovereignty of Human Approval"  
**Audience:** PayPal AI Hackathon Judges

---

### [0:00 - 0:20] Hook & Problem Statement
- **Screen:** Show the clean InvoicePilot dashboard with financial metric cards and the dual-pane interface (Left: Invoices Table, Right: AI Invoice Copilot).
- **Voiceover:**  
  *"Freelancers lose nearly six hours every week wrestling with billing software, calculating hourly rates, and chasing overdue invoices. But giving an AI agent direct access to send invoices or move money is a recipe for disaster—hallucinations, accidental charges, and zero accountability.*  
  *Meet **InvoicePilot**—the first AI billing agent that combines the natural language speed of Claude 3.5 Sonnet with the battle-tested infrastructure of the **PayPal Invoicing API v2**, governed by a strict zero-privilege human-in-the-loop security gate."*

---

### [0:20 - 0:50] Natural Language Proposal Generation
- **Screen:** Screen zooms into the AI Copilot chat box on the right. User types:  
  `"Invoice Acme Corp $800 for logo design and brand guide, due in 14 days"` and hits Enter.
- **Visual:** The loading indicator pulsates ("Analyzing billing request & validating rates...").
- **Voiceover:**  
  *"Watch how easy this is. I simply type a request in plain English. The agent searches client memory for Acme Corp's billing email, calculates the due date 14 days out, and deterministically computes line item amounts in integer cents—ensuring zero floating-point math errors.*  
  *Notice: The agent did **not** send the invoice. Instead, it generated a structured proposal locked in an **Awaiting User Approval** state, backed by a cryptographic SHA-256 snapshot of the payload."*

---

### [0:50 - 1:15] The AI Safety Proof (Tamper Refusal Moment)
- **Screen:** Highlight the interactive ProposalCard. Hover over the subtle "Test Tamper" button at the bottom left.
- **Action:** Click **Test Tamper**.
- **Visual:** A crisp red alert immediately appears:  
  `"Security Gate Active — Refusal Verified: Tamper detected! Approval snapshot does not match cryptographic hash."`  
  Click on **Audit Trail** in the top navigation to show the `TAMPER_ATTEMPT` recorded in the immutable audit log.
- **Voiceover:**  
  *"Here is the core security innovation for the hackathon judges: What if a malicious script or prompt injection alters the price behind the scenes? When I click 'Test Tamper', the server recomputes the SHA-256 hash. Because a single dollar was changed, the system immediately halts the dispatch with an HTTP 422 refusal, locks the record as TAMPERED, and logs an immutable audit event. The AI has zero capability to bypass this gate."*

---

### [1:15 - 1:40] Live PayPal Invoicing v2 Dispatch & Buyer Checkout
- **Screen:** Return to the proposal card and click the blue **Approve & Send Invoice** button.
- **Visual:** Button changes to "Sending...", then immediately displays:  
  `"Dispatched to PayPal Sandbox: INV2-XXXX-XXXX"` with a green **Pay via PayPal** button.
- **Action:** Click **Pay via PayPal**. A new browser tab opens to `https://www.sandbox.paypal.com/invoice/p/#...`.
- **Visual:** Show the real hosted PayPal invoice portal for $800.00. Click **PayPal Checkout**, log in with the Sandbox Personal buyer account, and complete payment.
- **Action:** Return to the InvoicePilot dashboard and click **Refresh from PayPal** in the navbar.
- **Visual:** The invoice badge instantly flips from `SENT` to **🟢 PAID**, and the "Collected" metric card updates in real time!
- **Voiceover:**  
  *"When I click 'Approve & Send', the server dispatches the verified payload to the PayPal Invoicing API v2. It generates a live, hosted PayPal buyer link. In one click, the client pays securely using their PayPal wallet or card. Back on our dashboard, clicking 'Refresh from PayPal' queries the authoritative PayPal API and flips our status to PAID."*

---

### [1:40 - 2:00] Overdue Tracking & Polite Reminders
- **Screen:** Click the **Overdue** tab on the invoices table. Click the **Remind** button next to an overdue client.
- **Visual:** The AI drafts a friendly payment reminder email with customized tone and payment terms. Click **Approve & Send Reminder**.
- **Voiceover:**  
  *"InvoicePilot also tracks overdue invoices using strict timezone-aware date math. With one click, the agent drafts a polite reminder email and respects PayPal's 24-hour frequency rate limit.*  
  *With InvoicePilot, freelancers get paid faster with conversational simplicity, while PayPal's security and human governance ensure complete peace of mind. Thank you!"*
