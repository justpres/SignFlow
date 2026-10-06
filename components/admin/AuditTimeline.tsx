import React from 'react';
import { AuditLog } from '@/lib/types';
import { DownloadIcon } from '@/components/ui/Icons';

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
        <div key={log.id} className="relative min-w-0">
          {/* Timeline node */}
          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-black border-2 border-white ring-1 ring-neutral-300" aria-hidden="true" />
          <div className="flex flex-col space-y-0.5">
            <h4 className="text-sm font-semibold text-black leading-tight break-words">
              {actionLabels[log.action] || log.action}
            </h4>
            <time className="text-[11px] font-mono text-neutral-500">
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
            <div className="mt-2 text-xs text-neutral-600 bg-neutral-50 p-2.5 border border-neutral-200 overflow-hidden space-y-2">
              {Object.entries(log.metadata).map(([k, v]) => (
                <div key={k} className="flex flex-col space-y-0.5 min-w-0">
                  <span className="font-mono text-neutral-500 text-[11px]">{k}:</span>
                  {k === 'filePath' && typeof v === 'string' ? (
                    <div className="flex flex-col space-y-1 min-w-0 pt-0.5">
                      <a
                        href={`/api/contracts/${log.contractId}/download?type=${v.includes('signed') ? 'signed' : 'original'}`}
                        className="inline-flex items-center gap-1.5 text-black font-semibold underline hover:text-neutral-700 min-w-0 text-xs break-all"
                        title="Download PDF document"
                      >
                        <DownloadIcon className="w-3.5 h-3.5 flex-shrink-0 text-black" />
                        <span>{v.includes('signed') ? 'Download Signed PDF' : 'Download Original PDF'}</span>
                      </a>
                      <span className="text-[10px] font-mono text-neutral-400 break-all select-all">
                        {String(v)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-black font-medium break-all min-w-0 text-[11px]">{String(v)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
