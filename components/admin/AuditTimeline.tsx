import React from 'react';
import { AuditLog } from '@/lib/types';

interface AuditTimelineProps {
  logs: AuditLog[];
}

export function AuditTimeline({ logs }: AuditTimelineProps) {
  const actionLabels: Record<string, string> = {
    CONTRACT_CREATED: 'Contract Created',
    CONTRACT_SENT: 'Signing Link Generated & Sent',
    CONTRACT_OPENED: 'Client Opened Document',
    SIGNATURE_STARTED: 'Client Started Signature',
    SIGNATURE_COMPLETED: 'Client Submitted Signature',
    CONTRACT_SIGNED: 'Contract Finalized & Signed',
    SIGNED_PDF_GENERATED: 'Immutable Signed PDF Generated',
    CONTRACT_DOWNLOADED: 'Signed Document Downloaded',
    CONTRACT_REVOKED: 'Contract Revoked by Administrator',
    CONTRACT_EXPIRED: 'Contract Expired',
  };

  if (logs.length === 0) {
    return <p className="text-xs text-neutral-500 italic">No audit records available.</p>;
  }

  return (
    <div className="relative border-l border-neutral-300 ml-3 pl-4 space-y-6">
      {logs.map((log) => (
        <div key={log.id} className="relative">
          {/* Timeline node */}
          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-black border-2 border-white ring-1 ring-neutral-300" aria-hidden="true" />
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
            <h4 className="text-sm font-semibold text-black">
              {actionLabels[log.action] || log.action}
            </h4>
            <time className="text-xs font-mono text-neutral-500 mt-0.5 sm:mt-0">
              {new Date(log.timestamp).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </time>
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="mt-1 text-xs text-neutral-600 bg-neutral-50 p-2 border border-neutral-200">
              {Object.entries(log.metadata).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-mono text-neutral-500">{k}:</span>
                  <span className="text-black font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
