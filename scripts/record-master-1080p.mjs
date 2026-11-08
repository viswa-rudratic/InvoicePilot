// ==============================================================================
// InvoicePilot - Master Full HD 1080p Video Recording with Synchronized Audio
// Viewport: 1920x1080 (deviceScaleFactor: 2 for 4K-density razor-sharp text)
// Custom Cursor Injection: Visual glowing cursor with click ripple animation
// Exact Timeline Synchronization with AI Voiceover Audio
// ==============================================================================

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function smoothMouseMove(page, startX, startY, endX, endY, steps = 25, durationMs = 600) {
  const stepDelay = durationMs / steps;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Ease-in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const x = startX + (endX - startX) * ease;
    const y = startY + (endY - startY) * ease;
    await page.mouse.move(x, y);
    await delay(stepDelay);
  }
}

async function recordMasterDemo() {
  console.log('🎬 Starting InvoicePilot Master Full HD 1080p Demo Recording...');

  const videoDir = path.resolve('videos');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--start-maximized',
      '--enable-font-antialiasing',
      '--force-device-scale-factor=1.5',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5,
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  try {
    // 0. Pre-load dashboard and wait for networkidle
    console.log('⏳ Pre-loading dashboard and waiting for full UI hydration...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=InvoicePilot', { timeout: 15000 });
    await page.waitForSelector('text=Total Invoiced', { timeout: 15000 });
    await delay(1500);

    // Inject visual glowing cursor and click ripples
    await page.evaluate(() => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.style.cssText = `
        position: fixed;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.4) 70%, transparent 100%);
        border: 2px solid white;
        box-shadow: 0 0 15px rgba(37, 99, 235, 0.6), 0 2px 8px rgba(0,0,0,0.3);
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: transform 0.08s ease-out, width 0.15s ease, height 0.15s ease;
      `;
      document.body.appendChild(cursor);

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });

      window.addEventListener('mousedown', (e) => {
        cursor.style.width = '18px';
        cursor.style.height = '18px';

        const ripple = document.createElement('div');
        ripple.style.cssText = `
          position: fixed;
          left: ${e.clientX}px;
          top: ${e.clientY}px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          box-shadow: 0 0 12px #3b82f6;
          pointer-events: none;
          z-index: 999998;
          transform: translate(-50%, -50%) scale(1);
          animation: ripple-anim 0.5s ease-out forwards;
        `;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 550);
      });

      window.addEventListener('mouseup', () => {
        cursor.style.width = '24px';
        cursor.style.height = '24px';
      });

      const style = document.createElement('style');
      style.textContent = `
        @keyframes ripple-anim {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(5.5); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    });

    console.log('🏁 Starting Scene 1 at T=0 (Clean hydrated UI ready)...');

    // SCENE 1: Introduction (Total: 17.7s)
    // "Welcome to InvoicePilot, the human-governed AI billing agent for freelancers..."
    await smoothMouseMove(page, 960, 540, 280, 45, 30, 1000); // Brand header
    await delay(2500);

    // Hover over "PayPal Sandbox Live" glowing badge
    await smoothMouseMove(page, 280, 45, 410, 45, 20, 800);
    await delay(3000);

    // Move smoothly across Stats Cards
    await smoothMouseMove(page, 410, 45, 340, 130, 25, 900); // Total Invoiced
    await delay(2500);
    await smoothMouseMove(page, 340, 130, 680, 130, 25, 900); // Collected
    await delay(2500);
    await smoothMouseMove(page, 680, 130, 1020, 130, 25, 900); // Outstanding
    await delay(2500);
    await smoothMouseMove(page, 1020, 130, 1360, 130, 25, 900); // Overdue
    await delay(2500);

    // SCENE 2: Natural Language Invoice Creation (Total: 16.3s)
    // "Instead of wrestling with complex billing software, freelancers simply type..."
    console.log('📍 Scene 2: Natural Language Invoice Request...');
    await smoothMouseMove(page, 1360, 130, 1300, 720, 30, 1200); // Move to quick prompts
    await delay(1500);

    const quickPill = page.locator('button:has-text("Invoice Acme Corp $800")');
    if (await quickPill.isVisible()) {
      const box = await quickPill.boundingBox();
      if (box) {
        await smoothMouseMove(page, 1300, 720, box.x + box.width / 2, box.y + box.height / 2, 20, 700);
        await delay(1000);
        await page.mouse.down();
        await delay(120);
        await page.mouse.up();
      }
    }

    // Wait for pulsating loading bubble
    await delay(4000);
    await page.waitForSelector('text=Invoice Proposal (Preview)', { timeout: 30000 });
    console.log('  ✓ Proposal generated smoothly!');
    await delay(4500);

    // SCENE 3: Deterministic Proposal & SHA-256 Gate (Total: 22.3s)
    // "InvoicePilot automatically retrieves Acme Corp's billing email from client memory..."
    console.log('📍 Scene 3: Proposal Review & Deterministic Integrity...');
    // Scroll chat down to center proposal
    await page.mouse.wheel(0, 320);
    await delay(1500);

    // Highlight Acme Corp and email
    await smoothMouseMove(page, 1400, 500, 1300, 410, 25, 900);
    await delay(3500);

    // Highlight line item and deterministic $800.00
    await smoothMouseMove(page, 1300, 410, 1420, 510, 25, 900);
    await delay(4000);

    // Highlight "Requires explicit approval" badge
    await smoothMouseMove(page, 1420, 510, 1580, 620, 25, 900);
    await delay(4500);

    // SCENE 4: The Core Security Proof - Tamper Refusal (Total: 22.5s)
    // "What happens if a prompt injection or malicious script tampers with the price..."
    console.log('📍 Scene 4: Security Gate & Tamper Refusal Test...');
    const tamperBtn = page.locator('button:has-text("Test Tamper Rejection")').last();
    const tBox = await tamperBtn.boundingBox();
    if (tBox) {
      await smoothMouseMove(page, 1580, 620, tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, 25, 800);
      await delay(1200);
      await page.mouse.down();
      await delay(120);
      await page.mouse.up();
    }

    // Wait for red refusal banner to appear and shake
    await page.waitForSelector('text=Tamper Refusal Verification', { timeout: 15000 });
    console.log('  ✓ Tamper refusal verified on screen!');
    await delay(6500);

    // SCENE 5: Immutable Governance Audit Trail (Total: 13.1s)
    // "Let's inspect the Audit Trail. Here, the blocked tamper attempt is permanently recorded..."
    console.log('📍 Scene 5: Audit Trail Inspection...');
    const auditBtn = page.locator('button:has-text("Audit Trail")');
    const aBox = await auditBtn.boundingBox();
    if (aBox) {
      await smoothMouseMove(page, tBox ? tBox.x : 1300, tBox ? tBox.y : 600, aBox.x + aBox.width / 2, aBox.y + aBox.height / 2, 30, 900);
      await delay(800);
      await page.mouse.down();
      await delay(120);
      await page.mouse.up();
    }

    await page.waitForSelector('text=Governance & Security Audit Trail', { timeout: 10000 });
    await delay(3500);

    // Switch to PayPal REST API Logs tab
    const apiTab = page.locator('button:has-text("PayPal REST API Logs")');
    if (await apiTab.isVisible()) {
      const apiBox = await apiTab.boundingBox();
      if (apiBox) {
        await smoothMouseMove(page, aBox.x, aBox.y + 100, apiBox.x + apiBox.width / 2, apiBox.y + apiBox.height / 2, 20, 600);
        await delay(600);
        await apiTab.click();
        await delay(2500);
      }
    }

    // Close Audit Modal
    const closeBtn = page.locator('button:has-text("Close")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await delay(1200);
    }

    // SCENE 6: Explicit Approval & PayPal Live Dispatch (Total: 17.4s)
    // "Now let's approve the real invoice. When we click Approve and Send..."
    console.log('📍 Scene 6: Explicit Human Approval & PayPal Live Dispatch...');
    const approveBtn = page.locator('button:has-text("Approve & Send")').last();
    const appBox = await approveBtn.boundingBox();
    if (appBox) {
      await smoothMouseMove(page, 960, 540, appBox.x + appBox.width / 2, appBox.y + appBox.height / 2, 25, 800);
      await delay(1000);
      await page.mouse.down();
      await delay(120);
      await page.mouse.up();
    }

    // Wait for PayPal dispatch to complete
    console.log('⏳ Awaiting PayPal Sandbox Invoicing API v2 response...');
    await page.waitForSelector('text=Invoice Created & Sent via PayPal Sandbox!', { timeout: 45000 });
    console.log('  ✓ Dispatched to PayPal Sandbox successfully!');
    await delay(4500);

    // Move mouse over to left table to showcase the newly created PayPal Sandbox Live invoice
    await smoothMouseMove(page, appBox ? appBox.x : 1300, appBox ? appBox.y : 600, 450, 420, 30, 1000);
    await delay(4000);

    // SCENE 7: Polite Payment Reminders & Closing (Total: 17.8s)
    // "InvoicePilot also tracks overdue invoices using timezone-aware date math..."
    console.log('📍 Scene 7: Polite Payment Follow-Up Draft & Closing...');
    const remindBtn = page.locator('button:has-text("Remind")').first();
    if (await remindBtn.isVisible()) {
      const rBox = await remindBtn.boundingBox();
      if (rBox) {
        await smoothMouseMove(page, 450, 420, rBox.x + rBox.width / 2, rBox.y + rBox.height / 2, 25, 800);
        await delay(800);
        await remindBtn.click();
        await delay(1500);

        // Click send on chat to generate reminder draft
        const sendBtn = page.locator('button:has(svg.lucide-send)');
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForSelector('text=Payment Reminder Draft', { timeout: 30000 });
          await delay(4000);
        }
      }
    }

    // Final smooth pan up to the brand and stats
    await smoothMouseMove(page, 1300, 500, 960, 150, 30, 1200);
    await delay(3500);

    console.log('🎉 Recording complete! Finalizing Full HD 1080p stream...');
  } catch (err) {
    console.error('Error during master recording:', err);
  } finally {
    await page.close();
    await context.close();
    await browser.close();

    console.log('✅ Video stream flushed to disk.');
  }
}

recordMasterDemo();
