'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { StatsCards } from '@/components/StatsCards';
import { InvoiceList, InvoiceRecord } from '@/components/InvoiceList';
import { ChatInterface } from '@/components/ChatInterface';
import { AuditModal } from '@/components/AuditModal';

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);

  // Fetch invoices & computed summaries
  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.invoices || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Synchronize payment status directly with PayPal Sandbox Invoicing API v2
  const handleRefreshPayPal = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/invoices/sync', { method: 'POST' });
      await res.json();
      await fetchInvoices();
    } catch (err) {
      console.error('Failed to sync PayPal invoices', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Triggered when user clicks "Remind" button on an invoice in the table
  const handleDraftReminder = (invoiceId: string, invoiceNumber: string) => {
    setExternalPrompt(
      `Draft a polite payment reminder for invoice #${invoiceNumber}`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenAudit={() => setIsAuditOpen(true)}
        onRefreshPayPal={handleRefreshPayPal}
        isSyncing={isSyncing}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Metric Cards Banner */}
        <StatsCards summary={summary} />

        {/* Core Dual-Pane Layout: Left = Invoices / Right = AI Copilot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-250px)] min-h-[600px]">
          {/* Left Column: Receivables & Invoices Table */}
          <section className="lg:col-span-7 h-full flex flex-col">
            <InvoiceList
              invoices={invoices}
              isLoading={isLoading}
              onRefresh={fetchInvoices}
              onDraftReminder={handleDraftReminder}
            />
          </section>

          {/* Right Column: AI Invoice Copilot */}
          <section className="lg:col-span-5 h-full flex flex-col">
            <ChatInterface
              onInvoiceChange={fetchInvoices}
              externalPrompt={externalPrompt}
              onClearExternalPrompt={() => setExternalPrompt(null)}
            />
          </section>
        </div>
      </main>

      {/* Governance & Audit Log Drawer */}
      <AuditModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
    </div>
  );
}
