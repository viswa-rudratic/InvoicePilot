'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  ShieldCheck,
  ShieldAlert,
  Server,
  Clock,
  RotateCw,
  CheckCircle,
  AlertCircle,
  FileCode,
} from 'lucide-react';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'api'>('audit');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.auditLogs || []);
        setApiLogs(data.apiLogs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Governance & Security Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Zero Money-Movement Privilege &bull; Canonical SHA-256 Verification &bull; Idempotent PayPal Calls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh logs"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2">
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Human Approval Events ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'api'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>PayPal REST API Logs ({apiLogs.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto">
          {isLoading && auditLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading audit records...
            </div>
          ) : activeTab === 'audit' ? (
            /* Audit Log List */
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-xs">No audit logs recorded yet.</p>
              ) : (
                auditLogs.map((log) => {
                  const isTamper = log.action === 'TAMPER_ATTEMPT';
                  const isApproved = log.action === 'APPROVAL_GRANTED' || log.action === 'INVOICE_SENT';

                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border text-xs transition-colors ${
                        isTamper
                          ? 'bg-rose-50/70 border-rose-200'
                          : isApproved
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {isTamper ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              <ShieldAlert className="w-3 h-3" />
                              TAMPER ATTEMPT BLOCKED
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              <CheckCircle className="w-3 h-3" />
                              {log.action}
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">
                            {log.entityType} ({log.entityId || 'N/A'})
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString()} &bull;{' '}
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* JSON Details Toggle */}
                      {log.detailsJson && (
                        <div className="mt-2 bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                          <pre>{JSON.stringify(JSON.parse(log.detailsJson), null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* PayPal API Logs List */
            <div className="space-y-3">
              {apiLogs.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-xs">No PayPal API calls recorded yet.</p>
              ) : (
                apiLogs.map((log) => {
                  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                            {log.method}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{log.endpoint}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSuccess
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            HTTP {log.statusCode}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          {log.durationMs}ms &bull; {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono">
                        RequestId: <span className="text-slate-800">{log.requestId}</span>
                      </div>

                      {log.errorMessage && (
                        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 font-mono text-[10px] whitespace-pre-wrap">
                          {log.errorMessage}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Security Guarantee: Server enforces exact immutable payload snapshots with zero client tampering.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
