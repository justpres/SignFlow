import React from 'react';
import { DocumentIcon } from './Icons';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionText,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-neutral-300 bg-neutral-50/50">
      <div className="p-3 bg-white border border-neutral-200 mb-4">
        <DocumentIcon className="w-8 h-8 text-neutral-600" />
      </div>
      <h3 className="text-base font-bold text-black">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-sm mt-1 mb-6">{description}</p>
      {actionText && (
        actionHref ? (
          <a
            href={actionHref}
            className="inline-flex items-center justify-center font-medium bg-black text-white hover:bg-neutral-800 border border-black text-sm px-4 py-2.5 h-10 transition-colors"
          >
            {actionText}
          </a>
        ) : (
          <Button onClick={onAction}>{actionText}</Button>
        )
      )}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-neutral-200 ${className}`}
      aria-hidden="true"
    />
  );
}
