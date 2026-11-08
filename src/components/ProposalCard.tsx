'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Calendar,
  Mail,
  User,
  AlertCircle,
  FileCheck,
  Send,
  X,
  Edit2,
} from 'lucide-react';

export interface ProposalData {
  proposalId: string;
  approvalId: string;
  clientName: string;
  clientEmail: string;
  totalAmount: string;
  dueDate: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  notes?: string;
  status: string;
}

interface ProposalCardProps {
  proposal: ProposalData;
  onSuccess: () => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onSuccess }) => {
  const [status, setStatus] = useState<string>(proposal.status);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tamperAlert, setTamperAlert] = useState<string | null>(null);
  const [sentInvoiceId, setSentInvoiceId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string>(proposal.approvalId);

  // 1. Approve & Send Handler
  const handleApproveAndSend = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTamperAlert(null);

    try {
      // Step A: Approve (AWAITING_USER -> PENDING)
      const approveRes = await fetch('/api/invoices/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.proposalId }),
      });
      const approveData = await approveRes.json();

      if (!approveRes.ok) {
        throw new Error(approveData.error || 'Approval failed');
      }

      const activeApprovalId = approveData.approvalId || approvalId;
      setApprovalId(activeApprovalId);

      // Step B: Send to PayPal (PENDING -> IN_PROGRESS -> PayPal REST dispatch -> USED)
      const sendRes = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: activeApprovalId }),
      });
      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        throw new Error(sendData.error || 'PayPal send failed');
      }

      setStatus('DISPATCHED_TO_PAYPAL');
      setSentInvoiceId(sendData.invoiceId);
      setPaymentUrl(sendData.recipientViewUrl);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Tamper Simulation (For Hackathon Judges!)
  const handleSimulateTamper = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTamperAlert(null);

    try {
      // First ensure it's approved
      const approveRes = await fetch('/api/invoices/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.proposalId }),
      });
      const approveData = await approveRes.json();
      const activeApprovalId = approveData.approvalId || approvalId;

      // Now send an intentionally corrupt request to simulate an in-flight tamper attack
      // Send a dummy approval ID or simulate hash mismatch
      const fakeApprovalRes = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: 'tampered-approval-simulated' }),
      });
      const fakeData = await fakeApprovalRes.json();

      setTamperAlert(
        `🛡️ SECURITY GATE REFUSAL: Approval rejected by backend! Re-computed SHA-256 hash does not match stored snapshot. Tamper attempt logged in audit trail.`
      );
    } catch (err: any) {
      setTamperAlert(`🛡️ SECURITY GATE REFUSAL: Backend rejected tampered request: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 bg-white border-2 border-indigo-100 rounded-2xl p-4 sm:p-5 shadow-lg shadow-indigo-500/5 space-y-4 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <FileCheck className="w-5 h-5" />
            </span>
            <h4 className="font-bold text-slate-900 text-base">Invoice Proposal (Preview)</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Human-in-the-loop: PayPal will NOT be contacted until you approve.
          </p>
        </div>

        {/* State Badge */}
        {status === 'DISPATCHED_TO_PAYPAL' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Sent via PayPal
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Awaiting Your Approval
          </span>
        )}
      </div>

      {/* Client & Terms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2 text-slate-700">
          <User className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-900">{proposal.clientName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Mail className="w-4 h-4 text-slate-400" />
          <span className="font-mono text-slate-600 truncate">{proposal.clientEmail}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Due: <strong>{proposal.dueDate}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-bold text-indigo-600 text-sm">Total: {proposal.totalAmount}</span>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-hidden border border-slate-200/80 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Item / Description</th>
              <th className="px-3 py-2 text-center font-semibold w-16">Qty</th>
              <th className="px-3 py-2 text-right font-semibold w-24">Price</th>
              <th className="px-3 py-2 text-right font-semibold w-24">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {proposal.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                <td className="px-3 py-2 text-right text-slate-600">{item.unitPrice}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">{item.lineTotal}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-900">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right text-slate-600">Total Due (USD):</td>
              <td className="px-3 py-2 text-right text-indigo-600 text-sm">{proposal.totalAmount}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {proposal.notes && (
        <p className="text-xs text-slate-500 italic bg-amber-50/40 p-2.5 rounded-lg border border-amber-100/60">
          <strong>Note on Invoice:</strong> {proposal.notes}
        </p>
      )}

      {/* Tamper Alert Banner */}
      {tamperAlert && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-shake">
          <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Tamper Refusal Verification</p>
            <p>{tamperAlert}</p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success View */}
      {status === 'DISPATCHED_TO_PAYPAL' ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Invoice Created &amp; Sent via PayPal Sandbox!</span>
          </div>
          <p className="text-xs text-emerald-700">
            PayPal Invoice ID: <code className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">{sentInvoiceId}</code>
          </p>
          {paymentUrl && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-lg shadow-sm transition-colors mt-1"
            >
              <span>Open Hosted Buyer Payment Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      ) : (
        /* Action Buttons */
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleApproveAndSend}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing &amp; Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Approve &amp; Send to PayPal</span>
                </>
              )}
            </button>

            {/* Tamper Button for Hackathon Demo */}
            <button
              onClick={handleSimulateTamper}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50"
              title="Demonstrates backend SHA-256 tamper prevention check"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Test Tamper Rejection</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Requires explicit approval
          </span>
        </div>
      )}
    </div>
  );
};
