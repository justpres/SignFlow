'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Contract } from '@/lib/types';
import { ContractTable } from '@/components/admin/ContractTable';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export default function AdminDashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [revokeContractTarget, setRevokeContractTarget] = useState<Contract | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch('/api/contracts');
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch (e) {
      console.error('Failed to load contracts:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Compute key overview counts
  const pendingCount = contracts.filter((c) => c.status === 'SENT' || c.status === 'OPENED').length;
  const signedCount = contracts.filter((c) => c.status === 'SIGNED').length;
  const expiredCount = contracts.filter((c) => c.status === 'EXPIRED').length;

  const handleRevokeConfirm = async () => {
    if (!revokeContractTarget) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/contracts/${revokeContractTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE' }),
      });
      if (res.ok) {
        await fetchContracts();
        setRevokeContractTarget(null);
      }
    } catch (e) {
      console.error('Revoke failed:', e);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">Contract Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Monitor active signing requests, audit histories, and finalized documents.
          </p>
        </div>
        <div>
          <Link
            href="/admin/contracts/new"
            className="inline-flex items-center justify-center font-medium bg-black text-white hover:bg-neutral-800 border border-black text-sm px-4 py-2.5 h-10 transition-colors"
          >
            Create Contract
          </Link>
        </div>
      </div>

      {/* Top Status Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 border border-neutral-200 bg-white">
          <div className="text-xs uppercase tracking-wider font-semibold text-neutral-500">Pending Signature</div>
          <div className="text-3xl font-bold text-black mt-1">{pendingCount}</div>
        </div>
        <div className="p-4 border border-neutral-200 bg-white">
          <div className="text-xs uppercase tracking-wider font-semibold text-neutral-500">Signed & Finalized</div>
          <div className="text-3xl font-bold text-black mt-1">{signedCount}</div>
        </div>
        <div className="p-4 border border-neutral-200 bg-white">
          <div className="text-xs uppercase tracking-wider font-semibold text-neutral-500">Expired</div>
          <div className="text-3xl font-bold text-black mt-1">{expiredCount}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-bold text-black">Recent Contracts</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : contracts.length === 0 ? (
          <EmptyState
            title="No contracts yet"
            description="Upload your first contract document to generate a private signing link for your client."
            actionText="Create Contract"
            actionHref="/admin/contracts/new"
          />
        ) : (
          <ContractTable
            contracts={contracts}
            onCopyLink={() => {}}
            onRevoke={(contract) => setRevokeContractTarget(contract)}
          />
        )}
      </div>

      {/* Revoke Confirmation Modal */}
      <Modal
        isOpen={Boolean(revokeContractTarget)}
        onClose={() => setRevokeContractTarget(null)}
        title="Revoke Signing Request"
        description="Are you sure you want to disable this signing request? The client will no longer be able to open or complete this agreement."
      >
        <div className="space-y-4">
          <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs">
            <div><span className="font-semibold">Contract:</span> {revokeContractTarget?.title}</div>
            <div><span className="font-semibold">Client:</span> {revokeContractTarget?.clientName}</div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" onClick={() => setRevokeContractTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRevokeConfirm}
              isLoading={isRevoking}
              loadingText="Revoking..."
            >
              Confirm Revocation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
