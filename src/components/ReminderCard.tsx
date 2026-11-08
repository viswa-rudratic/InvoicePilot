'use client';

import React, { useState } from 'react';
import {
  Bell,
  Mail,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Send,
} from 'lucide-react';

export interface ReminderData {
  approvalId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  totalAmount: string;
  dueDate: string;
  tone: 'polite' | 'firm';
  draftSubject: string;
  draftNote: string;
  status: string;
}

interface ReminderCardProps {
  reminder: ReminderData;
  onSuccess: () => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({ reminder, onSuccess }) => {
  const [status, setStatus] = useState<string>(reminder.status);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tamperAlert, setTamperAlert] = useState<string | null>(null);

  const handleApproveAndSend = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTamperAlert(null);

    try {
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: reminder.approvalId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch reminder');
      }

      setStatus('DISPATCHED');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateTamper = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTamperAlert(null);

    try {
      // In tamper simulation, modify snapshot behind the scenes to verify security gate
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: reminder.approvalId, _simulateTamper: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setTamperAlert(data.error || 'Tamper detected: SHA-256 hash mismatch.');
      } else {
        setStatus('DISPATCHED');
        onSuccess();
      }
    } catch (err: any) {
      setTamperAlert(err.message || 'Security gate triggered');
    } finally {
      setIsLoading(false);
    }
  };

  const isPolite = reminder.tone === 'polite';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md p-5 my-3 transition-all hover:border-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Payment Reminder Draft
            </span>
            <h4 className="text-sm font-bold text-slate-900">
              Invoice #{reminder.invoiceNumber}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold ${
              isPolite
                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
            }`}
          >
            {reminder.tone.toUpperCase()} TONE
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
            Awaiting Approval
          </span>
        </div>
      </div>

      {/* Recipient & Invoice Details */}
      <div className="grid grid-cols-2 gap-3 py-3 text-xs border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-600">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-900">{reminder.clientName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Mail className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate">{reminder.clientEmail}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900">{reminder.totalAmount}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Due: {reminder.dueDate}</span>
        </div>
      </div>

      {/* Reminder Message Preview */}
      <div className="py-3">
        <div className="mb-1 text-xs font-semibold text-slate-700">Subject:</div>
        <div className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-medium text-slate-800 border border-slate-200/70 mb-3">
          {reminder.draftSubject}
        </div>

        <div className="mb-1 text-xs font-semibold text-slate-700">Message Note:</div>
        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 whitespace-pre-wrap font-sans border border-slate-200/70">
          {reminder.draftNote}
        </div>
      </div>

      {/* Tamper Alert Display */}
      {tamperAlert && (
        <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Security Gate Active — Refusal Verified</p>
            <p className="mt-0.5">{tamperAlert}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Reminder Send Failed</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'DISPATCHED' ? (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Reminder dispatched to recipient via PayPal Invoicing API.
          </span>
        </div>
      ) : (
        /* Action Buttons */
        <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
          <button
            onClick={handleSimulateTamper}
            disabled={isLoading}
            className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Demonstrate SHA-256 tamper refusal for hackathon judges"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Test Tamper</span>
          </button>

          <button
            onClick={handleApproveAndSend}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Approve & Send Reminder</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
