'use client';

import React from 'react';
import { ShieldCheck, RefreshCw, FileText, History } from 'lucide-react';

interface NavbarProps {
  onOpenAudit: () => void;
  onRefreshPayPal: () => void;
  isSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAudit,
  onRefreshPayPal,
  isSyncing,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                InvoicePilot
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                PayPal Sandbox Live
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              AI Invoice Agent for Freelancers &bull; Human-in-the-Loop Governance
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onRefreshPayPal}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
            title="Poll PayPal for updated payment statuses"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh from PayPal</span>
          </button>

          <button
            onClick={onOpenAudit}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-sm"
          >
            <History className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Audit Trail</span>
          </button>

          {/* Demo User Pill */}
          <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
              AR
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-800 leading-tight">Alex Rivera</p>
              <p className="text-[10px] text-slate-500 leading-tight">Rivera Creative Studio</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
