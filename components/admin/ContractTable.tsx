import React from 'react';
import Link from 'next/link';
import { Contract } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CopyIcon, DownloadIcon } from '@/components/ui/Icons';

interface ContractTableProps {
  contracts: Contract[];
  onCopyLink: (contract: Contract) => void;
  onRevoke: (contract: Contract) => void;
}

export function ContractTable({ contracts, onCopyLink, onRevoke }: ContractTableProps) {
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
                  <Link href={`/admin/contracts/${contract.id}`} className="hover:underline focus-visible:outline-black">
                    {contract.title}
                  </Link>
                  <div className="text-xs font-mono text-neutral-400 mt-0.5">{contract.id}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-neutral-900 font-medium">{contract.clientName}</div>
                  <div className="text-xs text-neutral-500">{contract.clientEmail}</div>
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
                  {new Date(contract.expiresAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
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
                <Link href={`/admin/contracts/${contract.id}`} className="font-bold text-base text-black hover:underline">
                  {contract.title}
                </Link>
                <div className="text-xs font-mono text-neutral-400 mt-0.5">{contract.id}</div>
              </div>
              <StatusBadge status={contract.status} />
            </div>

            <div className="text-xs text-neutral-700">
              <span className="font-semibold">Client:</span> {contract.clientName} ({contract.clientEmail})
            </div>

            <div className="flex justify-between text-xs text-neutral-500">
              <span>Expires: {new Date(contract.expiresAt).toLocaleDateString()}</span>
              <span>Created: {new Date(contract.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
