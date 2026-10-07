import React from 'react';
import { WarningIcon, LockIcon, CheckIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';

interface SigningErrorStateProps {
  type: 'EXPIRED' | 'REVOKED' | 'ALREADY_SIGNED' | 'NOT_FOUND' | 'ERROR' | 'WAITING_COUNTER_SIGN';
  signedAt?: string;
  onRefresh?: () => void;
}

export function SigningErrorState({ type, signedAt, onRefresh }: SigningErrorStateProps) {
  const configs = {
    WAITING_COUNTER_SIGN: {
      title: 'SIGNATURE SUBMITTED',
      description: 'Your signature has been recorded. This agreement is now awaiting sender counter-signature.',
      hint: signedAt ? `Submitted on ${new Date(signedAt).toLocaleString()}` : 'You will receive the final sealed document once completed.',
      icon: <CheckIcon className="w-8 h-8 text-black" />,
    },
    EXPIRED: {
      title: 'SIGNING LINK EXPIRED',
      description: 'This signing request has passed its expiration date and is no longer available.',
      hint: 'Please contact the document sender to request a renewed signing invitation.',
      icon: <WarningIcon className="w-8 h-8 text-black" />,
    },
    REVOKED: {
      title: 'SIGNING REQUEST UNAVAILABLE',
      description: 'The sender has disabled or revoked this signing request.',
      hint: 'If you believe this is an error, please reach out directly to the party who sent the document.',
      icon: <LockIcon className="w-8 h-8 text-black" />,
    },
    ALREADY_SIGNED: {
      title: 'CONTRACT ALREADY SIGNED',
      description: 'This contract has already been executed and completed.',
      hint: signedAt ? `Completed on ${new Date(signedAt).toLocaleString()}` : 'The finalized document is locked against modifications.',
      icon: <LockIcon className="w-8 h-8 text-black" />,
    },
    NOT_FOUND: {
      title: 'INVALID SIGNING LINK',
      description: 'The requested signing link is invalid or could not be found.',
      hint: 'Please verify that you copied the complete URL from your invitation message.',
      icon: <WarningIcon className="w-8 h-8 text-black" />,
    },
    ERROR: {
      title: 'UNABLE TO LOAD DOCUMENT',
      description: 'A network or system error occurred while loading this agreement.',
      hint: 'Please check your connection and refresh the page.',
      icon: <WarningIcon className="w-8 h-8 text-black" />,
    },
  }[type];

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-neutral-300 p-8 text-center bg-white shadow-sm">
        <div className="mx-auto w-12 h-12 flex items-center justify-center bg-neutral-100 border border-neutral-300 mb-4">
          {configs.icon}
        </div>
        <h1 className="text-lg font-bold tracking-tight text-black uppercase mb-2">{configs.title}</h1>
        <p className="text-sm text-neutral-600 mb-4">{configs.description}</p>
        <p className="text-xs text-neutral-500 border-t border-neutral-100 pt-3">{configs.hint}</p>

        {onRefresh && (
          <div className="mt-6">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
