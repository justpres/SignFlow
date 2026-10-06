import React from 'react';
import { ContractStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: ContractStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  // Purely Black & White with typographic and subtle border styling, no colors
  const statusStyles: Record<ContractStatus, string> = {
    DRAFT: 'bg-white text-neutral-600 border border-neutral-300 font-normal',
    SENT: 'bg-neutral-100 text-black border border-neutral-400 font-medium',
    OPENED: 'bg-neutral-100 text-black border border-neutral-500 font-medium',
    SIGNED: 'bg-black text-white border border-black font-semibold',
    EXPIRED: 'bg-white text-neutral-500 border border-dashed border-neutral-400 line-through',
    REVOKED: 'bg-neutral-200 text-neutral-800 border border-neutral-400 font-medium',
  };

  const statusLabels: Record<ContractStatus, string> = {
    DRAFT: 'Draft',
    SENT: 'Pending Signature',
    OPENED: 'Opened by Client',
    SIGNED: 'Signed & Completed',
    EXPIRED: 'Expired',
    REVOKED: 'Revoked',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs uppercase tracking-wider ${statusStyles[status]} ${className}`}
      aria-label={`Status: ${statusLabels[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
