'use client';

import React, { useEffect, useState } from 'react';
import { CheckIcon, DownloadIcon, LockIcon } from '@/components/ui/Icons';

interface SigningSuccessProps {
  contractTitle: string;
  clientName: string;
  signedAt: string;
  contractId: string;
  downloadUrl: string;
  isWaitingCounterSign?: boolean;
}

export function SigningSuccess({
  contractTitle,
  clientName,
  signedAt,
  contractId,
  downloadUrl,
  isWaitingCounterSign = false,
}: SigningSuccessProps) {
  // 5-second initial auto-close countdown
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [isAutoClosePaused, setIsAutoClosePaused] = useState(false);
  const [autoCloseAttempted, setAutoCloseAttempted] = useState(false);

  // 10-minute session expiration (600 seconds)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(600);
  const isSessionExpired = sessionSecondsLeft <= 0;

  // 1. Initial 5-second auto-close timer
  useEffect(() => {
    if (isAutoClosePaused || autoCloseAttempted) return;

    if (secondsRemaining <= 0) {
      setAutoCloseAttempted(true);
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
  }, [secondsRemaining, isAutoClosePaused, autoCloseAttempted]);

  // 2. 10-minute overall security session countdown
  useEffect(() => {
    if (sessionSecondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSessionSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionSecondsLeft]);

  const handleCloseNow = () => {
    setAutoCloseAttempted(true);
    try {
      window.close();
    } catch (err) {
      console.warn('Browser prevented window.close():', err);
    }
  };

  const handleKeepOpen = () => {
    setIsAutoClosePaused(true);
  };

  // Format 10-minute countdown (e.g. 09:42)
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Expired Session Blur Modal Overlay */}
      {isSessionExpired && (
        <div className="absolute inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="max-w-md w-full border border-black bg-white p-8 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-black text-white mx-auto flex items-center justify-center">
              <LockIcon className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-black uppercase">
              SESSION EXPIRED FOR SECURITY
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              This signing session was completed on <strong>{new Date(signedAt).toLocaleString()}</strong>.
              To protect your personal document privacy and identity, this download session has expired after 10 minutes.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCloseNow}
                className="w-full px-4 py-3 bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Success Container (Blurred if expired) */}
      <div
        className={`max-w-lg w-full border border-black p-8 bg-white shadow-sm space-y-6 transition-all duration-500 ${
          isSessionExpired ? 'filter blur-sm select-none pointer-events-none opacity-40' : ''
        }`}
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-black text-white mx-auto flex items-center justify-center">
            <CheckIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-black">
            {isWaitingCounterSign ? 'SIGNATURE SUBMITTED' : 'CONTRACT SIGNED'}
          </h1>
          <p className="text-sm text-neutral-600">
            {isWaitingCounterSign
              ? 'Your signature was recorded. The sender has been notified to counter-sign and seal this agreement.'
              : 'Your contract has been successfully completed and finalized.'}
          </p>
        </div>

        {/* Dynamic Notification Banners */}
        {!isAutoClosePaused && !autoCloseAttempted ? (
          // Initial 5-second countdown banner
          <div className="p-3 border border-black bg-neutral-900 text-white text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0 mr-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="truncate">
                Closing automatically in <strong className="font-mono text-white text-sm">{secondsRemaining}s</strong>
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleKeepOpen}
                className="text-[11px] underline text-neutral-300 hover:text-white cursor-pointer px-1 py-0.5"
              >
                Keep Open (10m)
              </button>
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
          // Active 10-minute download session banner
          <div className="p-3 border border-neutral-300 bg-neutral-50 text-neutral-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 mr-2">
              <span className="w-2 h-2 bg-black rounded-full shrink-0" />
              <div className="text-[11px] leading-tight truncate">
                <span>Download session active: </span>
                <strong className="font-mono text-black">{formatTime(sessionSecondsLeft)} remaining</strong>
                <span className="text-neutral-500 block text-[10px]">Page will blur and lock after 10 minutes.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseNow}
              className="text-[11px] bg-black text-white font-semibold px-2.5 py-1.5 cursor-pointer hover:bg-neutral-800 transition-colors shrink-0"
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
            onClick={handleKeepOpen}
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
