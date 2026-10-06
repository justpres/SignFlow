import React from 'react';
import { CheckIcon, DownloadIcon } from '@/components/ui/Icons';

interface SigningSuccessProps {
  contractTitle: string;
  clientName: string;
  signedAt: string;
  contractId: string;
  downloadUrl: string;
}

export function SigningSuccess({
  contractTitle,
  clientName,
  signedAt,
  contractId,
  downloadUrl,
}: SigningSuccessProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full border border-black p-8 bg-white shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-black text-white mx-auto flex items-center justify-center">
            <CheckIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-black">CONTRACT SIGNED</h1>
          <p className="text-sm text-neutral-600">
            Your contract has been successfully completed and finalized.
          </p>
        </div>

        <div className="p-4 bg-neutral-50 border border-neutral-200 text-xs space-y-2">
          <div className="flex justify-between py-1 border-b border-neutral-200">
            <span className="text-neutral-500 font-medium">Contract Title:</span>
            <span className="font-semibold text-black text-right">{contractTitle}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-200">
            <span className="text-neutral-500 font-medium">Signer Full Name:</span>
            <span className="font-semibold text-black">{clientName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-200">
            <span className="text-neutral-500 font-medium">Date & Time Signed:</span>
            <span className="font-mono text-black">{new Date(signedAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-neutral-500 font-medium">Contract Reference ID:</span>
            <span className="font-mono text-neutral-700">{contractId}</span>
          </div>
        </div>

        <div className="space-y-3">
          <a
            href={downloadUrl}
            className="w-full inline-flex items-center justify-center gap-2 font-medium bg-black text-white hover:bg-neutral-800 border border-black text-sm px-4 py-3.5 transition-colors text-center"
          >
            <DownloadIcon className="w-4 h-4" />
            DOWNLOAD SIGNED PDF
          </a>
          <p className="text-xs text-neutral-500 text-center">
            Please download and keep a copy of this finalized document for your records.
          </p>
        </div>
      </div>
    </div>
  );
}
