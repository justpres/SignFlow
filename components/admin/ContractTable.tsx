import React from 'react';
import Link from 'next/link';
import { Contract } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DownloadIcon } from '@/components/ui/Icons';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ContractTableProps {
  contracts: Contract[];
  onCopyLink?: (contract: Contract) => void;
  onRevoke: (contract: Contract) => void;
  onDelete?: (contract: Contract) => void;
}

export function ContractTable({ contracts, onCopyLink: _onCopyLink, onRevoke, onDelete }: ContractTableProps) {
  return (
    <div>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto border border-neutral-200">
        <table className="w-full text-left text-sm divide-y divide-neutral-200">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
            <tr>
              <th scope="col" className="px-6 py-3">Contract</th>
              <th scope="col" className="px-6 py-3">Client</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3">Created</th>
              <th scope="col" className="px-6 py-3">Expiration</th>
              <th scope="col" className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {contracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-neutral-50/80 transition-colors">
                <td className="px-6 py-4 font-semibold text-black">
                  <Link
                    href={contract.status === 'DRAFT' ? `/admin/contracts/new?draftId=${contract.id}` : `/admin/contracts/${contract.id}`}
                    className="hover:underline focus-visible:outline-black"
                  >
                    {contract.title || 'Untitled Draft'}
                  </Link>
                  <div className="text-xs font-mono text-neutral-400 mt-0.5">
                    {contract.id}
                    {contract.ownerEmail && (
                      <span className="text-neutral-500 font-sans ml-1.5">• by {contract.ownerName || contract.ownerEmail}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar
                      name={contract.clientName}
                      email={contract.clientEmail}
                      size="sm"
                    />
                    <div>
                      <div className="text-neutral-900 font-medium">
                        {contract.clientName || <span className="text-neutral-400 italic">Not set</span>}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {contract.clientEmail || (contract.status === 'DRAFT' ? <span className="text-neutral-400 italic">Draft</span> : '')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={contract.status} />
                </td>
                <td className="px-6 py-4 text-xs text-neutral-600">
                  {new Date(contract.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-6 py-4 text-xs text-neutral-600">
                  {contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }) : '—'}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  {contract.status === 'DRAFT' ? (
                    <>
                      <Link
                        href={`/admin/contracts/new?draftId=${contract.id}`}
                        className="inline-flex items-center px-2.5 py-1 text-xs border border-black bg-black text-white hover:bg-neutral-800 font-medium focus-visible:outline-black"
                      >
                        Continue / Edit →
                      </Link>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(contract)}
                          className="inline-flex px-2.5 py-1 text-xs border border-neutral-300 hover:border-black text-neutral-700 hover:text-black cursor-pointer focus-visible:outline-black"
                          title="Delete draft"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  ) : contract.status === 'WAITING_COUNTER_SIGN' ? (
                    <>
                      <Link
                        href={`/admin/contracts/${contract.id}`}
                        className="inline-flex items-center px-2.5 py-1 text-xs border border-black bg-black text-white hover:bg-neutral-800 font-medium focus-visible:outline-black animate-pulse"
                      >
                        Counter-Sign →
                      </Link>
                      <button
                        type="button"
                        onClick={() => onRevoke(contract)}
                        className="inline-flex px-2.5 py-1 text-xs border border-neutral-300 hover:border-black text-neutral-700 hover:text-black cursor-pointer focus-visible:outline-black"
                      >
                        Revoke
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/admin/contracts/${contract.id}`}
                        className="inline-flex px-2.5 py-1 text-xs border border-neutral-300 hover:border-black font-medium text-black focus-visible:outline-black"
                      >
                        View
                      </Link>

                      {contract.status !== 'SIGNED' && contract.status !== 'REVOKED' && contract.status !== 'EXPIRED' && (
                        <button
                          type="button"
                          onClick={() => onRevoke(contract)}
                          className="inline-flex px-2.5 py-1 text-xs border border-neutral-300 hover:border-black text-neutral-700 hover:text-black cursor-pointer focus-visible:outline-black"
                        >
                          Revoke
                        </button>
                      )}

                      {contract.status === 'SIGNED' && (
                        <a
                          href={`/api/contracts/${contract.id}/download?type=signed`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-black bg-black text-white hover:bg-neutral-800 font-medium"
                          title="Download signed PDF"
                        >
                          <DownloadIcon className="w-3.5 h-3.5" />
                          PDF
                        </a>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards View */}
      <div className="md:hidden space-y-4">
        {contracts.map((contract) => (
          <div key={contract.id} className="border border-neutral-200 p-4 bg-white space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <Link
                  href={contract.status === 'DRAFT' ? `/admin/contracts/new?draftId=${contract.id}` : `/admin/contracts/${contract.id}`}
                  className="font-bold text-base text-black hover:underline"
                >
                  {contract.title || 'Untitled Draft'}
                </Link>
                <div className="text-xs font-mono text-neutral-400 mt-0.5">
                  {contract.id}
                  {contract.ownerEmail && (
                    <span className="text-neutral-500 font-sans ml-1.5">• by {contract.ownerName || contract.ownerEmail}</span>
                  )}
                </div>
              </div>
              <StatusBadge status={contract.status} />
            </div>

            <div className="text-xs text-neutral-700 flex items-center gap-2 pt-1 border-t border-neutral-100">
              <UserAvatar
                name={contract.clientName}
                email={contract.clientEmail}
                size="xs"
              />
              <div className="min-w-0 truncate">
                <span className="font-semibold">Client:</span> {contract.clientName || 'Not set'} {contract.clientEmail ? `(${contract.clientEmail})` : ''}
              </div>
            </div>

            <div className="flex justify-between text-xs text-neutral-500">
              <span>Expires: {contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString() : '—'}</span>
              <span>Created: {new Date(contract.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
              {contract.status === 'DRAFT' ? (
                <>
                  <Link
                    href={`/admin/contracts/new?draftId=${contract.id}`}
                    className="text-xs font-semibold text-black underline"
                  >
                    Continue / Edit →
                  </Link>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(contract)}
                      className="px-2 py-1 text-xs border border-neutral-300 text-neutral-700 cursor-pointer"
                    >
                      Delete Draft
                    </button>
                  )}
                </>
              ) : contract.status === 'WAITING_COUNTER_SIGN' ? (
                <>
                  <Link
                    href={`/admin/contracts/${contract.id}`}
                    className="px-2.5 py-1 text-xs bg-black text-white font-medium"
                  >
                    Counter-Sign →
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRevoke(contract)}
                    className="px-2 py-1 text-xs border border-neutral-300 text-neutral-700 cursor-pointer"
                  >
                    Revoke
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/admin/contracts/${contract.id}`}
                    className="text-xs font-semibold text-black underline"
                  >
                    View Details
                  </Link>
                  <div className="flex space-x-2">
                    {contract.status !== 'SIGNED' && contract.status !== 'REVOKED' && contract.status !== 'EXPIRED' && (
                      <button
                        type="button"
                        onClick={() => onRevoke(contract)}
                        className="px-2 py-1 text-xs border border-neutral-300 text-neutral-700 cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                    {contract.status === 'SIGNED' && (
                      <a
                        href={`/api/contracts/${contract.id}/download?type=signed`}
                        className="px-2 py-1 text-xs bg-black text-white font-medium inline-flex items-center gap-1"
                      >
                        <DownloadIcon className="w-3 h-3" />
                        Download
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
