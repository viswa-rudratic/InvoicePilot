'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  FileText,
  Mail,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  paypalInvoiceId: string | null;
  recordType: 'PAYPAL_SYNCED' | 'LOCAL_DEMO';
  status: string;
  clientName: string;
  clientEmail: string;
  totalAmountCents: number;
  totalAmountStr: string;
  currency: string;
  dueDate: string;
  invoiceDate: string;
  recipientViewUrl: string | null;
  notes?: string | null;
  isOverdue: boolean;
  lastSyncedAt?: string | null;
  latestApprovalId?: string | null;
  approvalStatus?: string | null;
}

interface InvoiceListProps {
  invoices: InvoiceRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onDraftReminder: (invoiceId: string, invoiceNumber: string) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  isLoading,
  onRefresh,
  onDraftReminder,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OVERDUE' | 'PAID' | 'UNPAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filter & Search logic
  const filteredInvoices = invoices.filter((inv) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q) ||
        (inv.paypalInvoiceId && inv.paypalInvoiceId.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Filter Tab
    if (filter === 'OVERDUE') return inv.isOverdue;
    if (filter === 'PAID') return inv.status === 'PAID' || inv.status === 'MARKED_AS_PAID';
    if (filter === 'UNPAID')
      return inv.status !== 'PAID' && inv.status !== 'MARKED_AS_PAID' && inv.status !== 'CANCELLED';

    return true;
  });

  // Handle Retry Send
  const handleRetrySend = async (approvalId: string, invoiceId: string) => {
    setRetryingId(invoiceId);
    setRetryMessage(null);

    try {
      const res = await fetch('/api/invoices/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Retry send failed');
      }

      setRetryMessage({ id: invoiceId, text: 'Invoice dispatched successfully!' });
      onRefresh();
    } catch (err: any) {
      setRetryMessage({ id: invoiceId, text: err.message || 'Retry failed', error: true });
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          OVERDUE
        </span>
      );
    }

    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            PAID
          </span>
        );
      case 'MARKED_AS_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            MARKED PAID
          </span>
        );
      case 'SENT':
      case 'UNPAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            SENT
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            DRAFT (NOT SENT)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
      {/* Top Header & Search Bar */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Invoices & Receivables
            </h2>
            <p className="text-xs text-slate-500">
              Deterministic calculations &bull; Overdue tracked via IST date math
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(['ALL', 'UNPAID', 'OVERDUE', 'PAID'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'ALL'
                  ? `All (${invoices.length})`
                  : tab === 'OVERDUE'
                  ? `Overdue (${invoices.filter((i) => i.isOverdue).length})`
                  : tab === 'PAID'
                  ? `Paid (${invoices.filter((i) => i.status === 'PAID' || i.status === 'MARKED_AS_PAID').length})`
                  : `Unpaid (${invoices.filter((i) => i.status !== 'PAID' && i.status !== 'MARKED_AS_PAID' && i.status !== 'CANCELLED').length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by client, invoice #, or PayPal ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Invoice List Table */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {isLoading && invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No invoices found matching your criteria.
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const isExpanded = expandedRowId === inv.id;
            const canRetry = inv.status === 'DRAFT' && inv.latestApprovalId;

            return (
              <div
                key={inv.id}
                className={`transition-colors hover:bg-slate-50/70 ${
                  inv.isOverdue ? 'bg-rose-50/20' : ''
                }`}
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left Column: Number & Client */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {inv.invoiceNumber}
                      </span>
                      {getStatusBadge(inv.status, inv.isOverdue)}
                      {/* Data Honesty Badge */}
                      {inv.recordType === 'PAYPAL_SYNCED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          PayPal Sandbox (Live)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Local Demo Record
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{inv.clientName}</span>
                      <span>&bull;</span>
                      <span className="text-slate-400">{inv.clientEmail}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Due: <strong className="text-slate-600">{inv.dueDate}</strong></span>
                      {inv.paypalInvoiceId && (
                        <span>ID: <code className="text-slate-600 font-mono">{inv.paypalInvoiceId}</code></span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Amount & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900">
                        ${inv.totalAmountStr}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {inv.currency}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Live Buyer Payment Link */}
                      {inv.recipientViewUrl && (
                        <a
                          href={inv.recipientViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                          title="Open hosted PayPal buyer payment portal in new tab"
                        >
                          <span>Pay via PayPal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Retry Send Button if Draft */}
                      {canRetry && (
                        <button
                          onClick={() => handleRetrySend(inv.latestApprovalId!, inv.id)}
                          disabled={retryingId === inv.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50"
                        >
                          <RotateCw
                            className={`w-3 h-3 ${retryingId === inv.id ? 'animate-spin' : ''}`}
                          />
                          <span>{retryingId === inv.id ? 'Retrying...' : 'Retry Send'}</span>
                        </button>
                      )}

                      {/* Remind Button for Unpaid / Overdue */}
                      {inv.status !== 'PAID' && inv.status !== 'MARKED_AS_PAID' && inv.status !== 'DRAFT' && (
                        <button
                          onClick={() => onDraftReminder(inv.id, inv.invoiceNumber)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Ask AI agent to draft a polite reminder"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>Remind</span>
                        </button>
                      )}

                      {/* Expand / Details Toggle */}
                      <button
                        onClick={() => setExpandedRowId(isExpanded ? null : inv.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View details"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Retry Alert */}
                {retryMessage && retryMessage.id === inv.id && (
                  <div
                    className={`mx-4 mb-3 p-2 rounded-lg text-xs flex items-center gap-2 ${
                      retryMessage.error
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{retryMessage.text}</span>
                  </div>
                )}

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-600 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          Invoice Date
                        </span>
                        <span className="font-medium text-slate-800">{inv.invoiceDate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          Due Date
                        </span>
                        <span className="font-medium text-slate-800">{inv.dueDate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          PayPal Live ID
                        </span>
                        <span className="font-mono text-slate-800">
                          {inv.paypalInvoiceId || 'N/A (Local Demo)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          Last Synced
                        </span>
                        <span className="font-medium text-slate-800">
                          {inv.lastSyncedAt
                            ? new Date(inv.lastSyncedAt).toLocaleTimeString()
                            : 'Just now'}
                        </span>
                      </div>
                    </div>

                    {inv.notes && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Invoice Note:
                        </span>
                        <p className="text-slate-700 text-xs italic">{inv.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
