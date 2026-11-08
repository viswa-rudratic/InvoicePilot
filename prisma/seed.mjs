// ==============================================================================
// InvoicePilot - Database Seed Script
// Seeds:
// 1. Single demo user
// 2. Client Memory (clients, rates, notes)
// 3. Realistic Demo Invoices (1 PAID, 1 OVERDUE) clearly labeled LOCAL_DEMO
// 4. Milestone 1 Verified PayPal-synced invoice
// ==============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@invoicepilot.dev' },
    update: {},
    create: {
      id: 'demo-user-id',
      email: 'demo@invoicepilot.dev',
      name: 'Alex Rivera',
      businessName: 'Rivera Creative Studio',
      currency: 'USD',
    },
  });
  console.log(`✓ Demo user created: ${demoUser.name} (${demoUser.email})`);

  // 2. Client Memory
  const clients = [
    {
      name: 'Acme Corp',
      email: 'billing@acme.example.com',
      standardRateCents: 80000, // $800.00
      notes: 'Brand identity, logo design. Standard NET 14 terms.',
    },
    {
      name: 'TechFlow Labs',
      email: 'accounts@techflow.example.com',
      standardRateCents: 150000, // $1,500.00
      notes: 'Full-stack engineering & Next.js development. NET 15.',
    },
    {
      name: 'Global Ventures',
      email: 'finance@globalventures.example.com',
      standardRateCents: 50000, // $500.00
      notes: 'Advisory and design consulting. NET 14.',
    },
  ];

  for (const client of clients) {
    await prisma.clientMemory.upsert({
      where: {
        userId_email: {
          userId: demoUser.id,
          email: client.email,
        },
      },
      update: client,
      create: {
        userId: demoUser.id,
        ...client,
      },
    });
  }
  console.log(`✓ Seeded ${clients.length} clients in ClientMemory`);

  // 3. Seed Realistic Demo Invoices
  // Seed 1: PAID Local Demo Invoice
  const paidDemoInvoice = await prisma.invoice.upsert({
    where: { id: 'demo-invoice-paid-1' },
    update: {},
    create: {
      id: 'demo-invoice-paid-1',
      userId: demoUser.id,
      recordType: 'LOCAL_DEMO',
      invoiceNumber: 'INV-DEMO-001',
      status: 'PAID',
      clientName: 'TechFlow Labs',
      clientEmail: 'accounts@techflow.example.com',
      itemsJson: JSON.stringify([
        {
          name: 'Next.js 15 Web Platform Development',
          quantity: 1,
          unitAmountCents: 150000,
          description: 'Frontend and backend Route Handlers implementation',
        },
      ]),
      totalAmountCents: 150000,
      totalAmountStr: '1500.00',
      currency: 'USD',
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-15',
      notes: 'Demo fixture: Verified paid client invoice.',
      lastSyncedAt: new Date('2026-10-14'),
    },
  });

  // Seed 2: OVERDUE Local Demo Invoice
  const overdueDemoInvoice = await prisma.invoice.upsert({
    where: { id: 'demo-invoice-overdue-2' },
    update: {},
    create: {
      id: 'demo-invoice-overdue-2',
      userId: demoUser.id,
      recordType: 'LOCAL_DEMO',
      invoiceNumber: 'INV-DEMO-002',
      status: 'SENT', // SENT + past due date = OVERDUE
      clientName: 'Global Ventures',
      clientEmail: 'finance@globalventures.example.com',
      itemsJson: JSON.stringify([
        {
          name: 'Brand Advisory & Design Consulting',
          quantity: 1,
          unitAmountCents: 50000,
          description: 'Q4 Brand strategy consultation',
        },
      ]),
      totalAmountCents: 50000,
      totalAmountStr: '500.00',
      currency: 'USD',
      invoiceDate: '2026-10-10',
      dueDate: '2026-10-24', // Past due in IST -> Overdue!
      notes: 'Demo fixture: Overdue invoice for demonstrating reminder drafting.',
      lastSyncedAt: new Date('2026-10-10'),
    },
  });

  // Seed 3: Milestone 1 Verified PayPal Sandbox Invoice
  const m1Invoice = await prisma.invoice.upsert({
    where: { id: 'paypal-synced-m1' },
    update: {},
    create: {
      id: 'paypal-synced-m1',
      userId: demoUser.id,
      recordType: 'PAYPAL_SYNCED',
      paypalInvoiceId: 'INV2-GQ8A-8XG9-8E93-TN3T',
      invoiceNumber: 'INV-M1-568864',
      status: 'PAID',
      clientName: 'Sandbox Buyer',
      clientEmail: process.env.PAYPAL_BUYER_EMAIL || 'sb-t71bk53750800@personal.example.com',
      itemsJson: JSON.stringify([
        {
          name: 'Milestone 1 Verification Service',
          quantity: 1,
          unitAmountCents: 2500,
          description: 'Verified live via PayPal Sandbox Invoicing API v2',
        },
      ]),
      totalAmountCents: 2500,
      totalAmountStr: '25.00',
      currency: 'USD',
      invoiceDate: '2026-11-08',
      dueDate: '2026-11-22',
      recipientViewUrl: 'https://www.sandbox.paypal.com/invoice/p/#GQ8A8XG98E93TN3T',
      notes: 'Milestone 1 Sandbox live payment verification.',
      lastSyncedAt: new Date(),
    },
  });

  console.log(`✓ Seeded Demo Invoices:`);
  console.log(`  - Local Demo (PAID): ${paidDemoInvoice.invoiceNumber} ($${paidDemoInvoice.totalAmountStr})`);
  console.log(`  - Local Demo (OVERDUE): ${overdueDemoInvoice.invoiceNumber} ($${overdueDemoInvoice.totalAmountStr})`);
  console.log(`  - PayPal Live Synced (PAID): ${m1Invoice.paypalInvoiceId} ($${m1Invoice.totalAmountStr})`);
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
