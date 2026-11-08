'use client';

import React from 'react';
import { DollarSign, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface StatsProps {
  summary?: {
    totalInvoicedStr: string;
    totalCollectedStr: string;
    totalOutstandingStr: string;
    totalOverdueStr: string;
    totalCount: number;
    overdueCount: number;
    paidCount: number;
  };
}

export const StatsCards: React.FC<StatsProps> = ({ summary }) => {
  const invoiced = summary?.totalInvoicedStr || '0.00';
  const collected = summary?.totalCollectedStr || '0.00';
  const outstanding = summary?.totalOutstandingStr || '0.00';
  const overdue = summary?.totalOverdueStr || '0.00';
  const overdueCount = summary?.overdueCount || 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Invoiced */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">${invoiced}</p>
          <p className="text-xs text-slate-400 mt-0.5">{summary?.totalCount || 0} invoices recorded</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>

      {/* Total Collected */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Collected (Paid)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">${collected}</p>
          <p className="text-xs text-slate-400 mt-0.5">{summary?.paidCount || 0} invoices paid</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Outstanding */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">${outstanding}</p>
          <p className="text-xs text-slate-400 mt-0.5">Awaiting buyer payment</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      {/* Overdue */}
      <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Overdue</p>
            {overdueCount > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                {overdueCount}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-1">${overdue}</p>
          <p className="text-xs text-rose-500 mt-0.5">Calculated via IST date math</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
