'use client';

import React, { useEffect, useState } from 'react';
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
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [closedAttempted, setClosedAttempted] = useState(false);

  useEffect(() => {
    if (isPaused || closedAttempted) return;

    if (secondsRemaining <= 0) {
      setClosedAttempted(true);
      try {
        window.close();
      } catch (err) {
        console.warn('Browser prevented window.close():', err);
      }
      return;
    }

    const timer = setTimeout(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsRemaining, isPaused, closedAttempted]);

  const handleCloseNow = () => {
    setClosedAttempted(true);
    try {
      window.close();
    } catch (err) {
      console.warn('Browser prevented window.close():', err);
    }
  };

  const handleCancelAutoClose = () => {
    setIsPaused(true);
  };

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

        {/* 5-second countdown alert notification */}
        {!closedAttempted ? (
          <div className="p-3 border border-black bg-neutral-900 text-white text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0 mr-2">
              {!isPaused && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
              )}
              <span className="truncate">
                {isPaused ? (
                  <span className="text-neutral-300">Auto-close cancelled. You may download your document below.</span>
                ) : (
                  <span>
                    This page will close in <strong className="font-mono text-white text-sm">{secondsRemaining}s</strong>
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {!isPaused ? (
                <button
                  type="button"
                  onClick={handleCancelAutoClose}
                  className="text-[11px] underline text-neutral-300 hover:text-white cursor-pointer px-1 py-0.5"
                >
                  Keep Open
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleCloseNow}
                className="text-[11px] bg-white text-black font-semibold px-2 py-1 cursor-pointer hover:bg-neutral-200 transition-colors"
              >
                Close Now
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border border-neutral-300 bg-neutral-50 text-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-600">
              Session completed. You may safely close this tab now.
            </span>
            <button
              type="button"
              onClick={handleCloseNow}
              className="text-[11px] bg-black text-white font-semibold px-2 py-1 cursor-pointer hover:bg-neutral-800 transition-colors shrink-0 ml-3"
            >
              Close Tab
            </button>
          </div>
        )}

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
          <div className="p-3 border border-neutral-200 bg-neutral-50 flex items-center gap-2.5 text-xs text-neutral-700">
            <span className="w-2 h-2 bg-black shrink-0" />
            <span>
              <strong>Cryptographically Verified:</strong> Audit record and security checksums are embedded directly inside the document properties.
            </span>
          </div>

          <a
            href={downloadUrl}
            onClick={() => setIsPaused(true)}
            className="w-full inline-flex items-center justify-center gap-2 font-medium bg-black text-white hover:bg-neutral-800 border border-black text-sm px-4 py-3.5 transition-colors text-center cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4" />
            DOWNLOAD SIGNED PDF
          </a>
          <p className="text-xs text-neutral-500 text-center">
            Please download and retain an immutable copy of this executed document for your records.
          </p>
        </div>
      </div>
    </div>
  );
}
