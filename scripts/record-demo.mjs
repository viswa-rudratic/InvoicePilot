// ==============================================================================
// InvoicePilot - Automated Demo Video Recorder (Playwright)
// Records a high-definition 1280x720 video of the full end-to-end user journey:
// 1. Dashboard & metrics overview
// 2. Natural language invoice creation via Claude 3.5 Sonnet agent
// 3. The Core Safety Proof: Tamper Refusal & Audit Trail verification
// 4. Human-in-the-loop approval & PayPal Invoicing v2 live dispatch
// 5. Authentic hosted PayPal payment link verification
// 6. Polite payment reminder generation
// ==============================================================================

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function recordDemo() {
  console.log('🎬 Starting InvoicePilot Automated Demo Video Recording...');

  const videoDir = path.resolve('videos');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  // Launch browser with video recording enabled
  const browser = await chromium.launch({
    headless: false, // Visible recording so hardware acceleration captures smoothly
    channel: 'chrome', // Use system Google Chrome
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  try {
    // 1. Dashboard Overview
    console.log('📍 Scene 1: Dashboard Overview & Metrics...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await delay(3000);

    // Hover over Stats Cards
    await page.mouse.move(250, 120);
    await delay(1000);
    await page.mouse.move(550, 120);
    await delay(1000);

    // 2. Plain English Billing Request
    console.log('📍 Scene 2: Natural Language Invoice Request...');
    const quickPill = page.locator('button:has-text("Invoice Acme Corp $800")');
    if (await quickPill.isVisible()) {
      await quickPill.hover();
      await delay(800);
      await quickPill.click();
    } else {
      await page.fill('textarea', 'Invoice Acme Corp $800 for logo design and brand guide, due in 14 days');
      await delay(500);
      await page.click('button:has(svg.lucide-send)');
    }

    // Wait for proposal card to render
    console.log('⏳ Waiting for agent to generate structured proposal...');
    await page.waitForSelector('text=Invoice Proposal (Preview)', { timeout: 30000 });
    await delay(2500);

    // Smooth scroll down to proposal
    await page.mouse.wheel(0, 300);
    await delay(2000);

    // 3. The Core Safety Proof: Tamper Refusal
    console.log('📍 Scene 3: Security Gate & Tamper Refusal Test...');
    const tamperBtn = page.locator('button:has-text("Test Tamper")').last();
    await tamperBtn.hover();
    await delay(1200);
    await tamperBtn.click();

    // Verify tamper refusal banner appears
    await page.waitForSelector('text=Tamper Refusal Verification', { timeout: 45000 });
    console.log('  ✓ Tamper refusal verified on screen!');
    await delay(3500);

    // Open Audit Trail drawer to show immutable log
    console.log('📍 Scene 4: Audit Trail Inspection...');
    const auditBtn = page.locator('button:has-text("Audit Trail")');
    await auditBtn.hover();
    await delay(800);
    await auditBtn.click();
    await page.waitForSelector('text=Governance & Security Audit Trail', { timeout: 20000 });
    await delay(3000);

    // Switch to PayPal REST API Logs tab
    const apiTab = page.locator('button:has-text("PayPal REST API Logs")');
    await apiTab.hover();
    await delay(800);
    await apiTab.click();
    await delay(2500);

    // Close Audit Modal
    const closeBtn = page.locator('button:has-text("Close")');
    await closeBtn.hover();
    await delay(800);
    await closeBtn.click();
    await delay(1500);

    // 4. Human Approval & PayPal Invoicing v2 Live Dispatch
    console.log('📍 Scene 5: Explicit Human Approval & PayPal Live Dispatch...');
    const approveBtn = page.locator('button:has-text("Approve & Send")').last();
    await approveBtn.hover();
    await delay(1000);
    await approveBtn.click();

    // Wait for PayPal dispatch to complete
    console.log('⏳ Awaiting PayPal Sandbox Invoicing API v2 response...');
    await page.waitForSelector('text=Invoice Created & Sent via PayPal Sandbox!', { timeout: 45000 });
    await delay(3500);

    // Highlight the live "Pay via PayPal" / "Open Hosted" button
    const payLink = page.locator('a:has-text("Open Hosted Buyer Payment Page")').first();
    if (await payLink.isVisible()) {
      await payLink.hover();
      await delay(2000);
    }

    // 5. Overdue Tracking & Polite Payment Reminder
    console.log('📍 Scene 6: Polite Payment Follow-Up Draft...');
    const remindBtn = page.locator('button:has-text("Remind")').first();
    if (await remindBtn.isVisible()) {
      await remindBtn.hover();
      await delay(1000);
      await remindBtn.click();
      await delay(2000);

      // Submit reminder prompt
      const sendPromptBtn = page.locator('button:has(svg.lucide-send)');
      if (await sendPromptBtn.isVisible()) {
        await sendPromptBtn.click();
        await page.waitForSelector('text=Payment Reminder Draft', { timeout: 30000 });
        await delay(3000);
      }
    }

    // Final dashboard pan
    await page.mouse.wheel(0, -500);
    await delay(3000);

    console.log('🎉 Recording complete! Finalizing video stream...');
  } catch (err) {
    console.error('Error during demo recording:', err);
  } finally {
    // Closing context finalizes and flushes the video file
    await page.close();
    await context.close();
    await browser.close();

    // Rename recorded video file
    const files = fs.readdirSync(videoDir);
    const recordedFile = files.find((f) => f.endsWith('.webm'));
    if (recordedFile) {
      const finalPath = path.join(videoDir, 'InvoicePilot_Demo_Video.webm');
      fs.copyFileSync(path.join(videoDir, recordedFile), finalPath);
      console.log(`\n================================================================`);
      console.log(`✅ VIDEO SAVED SUCCESSFULLY:`);
      console.log(`📁 ${finalPath}`);
      console.log(`================================================================\n`);
    }
  }
}

recordDemo();
