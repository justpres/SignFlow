'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { InteractiveFastSigner } from '@/components/signing/InteractiveFastSigner';
import { SigningErrorState } from '@/components/signing/SigningErrorState';
import { SigningSuccess } from '@/components/signing/SigningSuccess';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LockIcon, WarningIcon, CheckIcon } from '@/components/ui/Icons';
import { PlacedField } from '@/lib/types';

interface ContractData {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  ownerEmail?: string;
  ownerName?: string;
  status: string;
  expiresAt: string;
  signedAt?: string;
  message?: string;
  signaturePage?: number;
  signatureX?: number;
  signatureY?: number;
  nameX?: number;
  nameY?: number;
  dateX?: number;
  dateY?: number;
  fields?: PlacedField[];
  requiresCounterSign?: boolean;
}

interface SigningFlowProps {
  token: string;
}

export function SigningFlow({ token }: SigningFlowProps) {
  // Contract data state
  const [contract, setContract] = useState<ContractData | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<'EXPIRED' | 'REVOKED' | 'ALREADY_SIGNED' | 'NOT_FOUND' | 'ERROR' | 'WAITING_COUNTER_SIGN' | null>(null);

  // Signer & signature state
  const [signerName, setSignerName] = useState<string>('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signaturePlacement, setSignaturePlacement] = useState<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Are You Sure confirmation modal state
  const [showAreYouSureModal, setShowAreYouSureModal] = useState<boolean>(false);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isWaitingCounterSign, setIsWaitingCounterSign] = useState<boolean>(false);

  // Final Success State
  const [finalSuccessData, setFinalSuccessData] = useState<{
    contractId: string;
    contractTitle: string;
    clientName: string;
    signedAt: string;
    downloadUrl: string;
  } | null>(null);

  const fetchContract = useCallback(async () => {
    setLoadingInitial(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/contracts/sign/${token}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) setFetchError('NOT_FOUND');
        else if (res.status === 410) setFetchError('EXPIRED');
        else if (res.status === 403) setFetchError('REVOKED');
        else setFetchError('ERROR');
        return;
      }

      if (data.contract.status === 'EXPIRED') {
        setFetchError('EXPIRED');
        return;
      }
      if (data.contract.status === 'REVOKED') {
        setFetchError('REVOKED');
        return;
      }
      if (data.contract.status === 'SIGNED' || data.contract.status === 'WAITING_COUNTER_SIGN') {
        setContract(data.contract);
        setFetchError(data.contract.status === 'WAITING_COUNTER_SIGN' ? 'WAITING_COUNTER_SIGN' : 'ALREADY_SIGNED');
        return;
      }

      setContract(data.contract);
      setPdfBase64(data.pdfBase64);
      setSignerName(data.contract.clientName || '');
    } catch {
      setFetchError('ERROR');
    } finally {
      setLoadingInitial(false);
    }
  }, [token]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  // Handle signature change from InteractiveFastSigner
  const handleSignatureChange = useCallback(
    (
      dataUrl: string | null,
      meta?: {
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }
    ) => {
      setSignatureDataUrl(dataUrl);
      if (meta) {
        setSignaturePlacement(meta);
      }
      if (dataUrl) {
        setValidationError(null);
      }
    },
    []
  );

  // Trigger Are You Sure modal
  const handleOpenConfirmation = () => {
    if (!signatureDataUrl) {
      setValidationError('Please draw your signature on the document before signing.');
      return;
    }
    setValidationError(null);
    setAgreedToTerms(false);
    setShowAreYouSureModal(true);
  };

  // Final submit handler
  const handleFinalSubmit = async () => {
    if (!signerName.trim()) {
      setValidationError('Please enter your full legal name before completing.');
      return;
    }
    if (!agreedToTerms) {
      setValidationError('You must agree to the contract terms and legal signature disclosure before sealing.');
      return;
    }
    if (!signatureDataUrl) {
      setValidationError('Signature is missing. Please draw your signature before finalizing.');
      setShowAreYouSureModal(false);
      return;
    }

    setIsFinalizing(true);
    setValidationError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const targetPage = signaturePlacement?.page || contract?.signaturePage || 1;
      const targetSigX = signaturePlacement?.x ?? contract?.signatureX ?? 70;
      const targetSigY = signaturePlacement?.y ?? contract?.signatureY ?? 115;
      const targetWidth = signaturePlacement?.width ?? 170;
      const targetHeight = signaturePlacement?.height ?? 50;

      const baseFields = (contract?.fields && contract.fields.length > 0)
        ? contract.fields.map((f) => {
            if (f.type === 'SIGNATURE') {
              return {
                ...f,
                page: targetPage,
                x: targetSigX,
                y: targetSigY,
                width: targetWidth,
                height: targetHeight,
                value: signatureDataUrl,
              };
            }
            if (f.type === 'DATE') {
              return {
                ...f,
                page: targetPage,
                value: today,
              };
            }
            return f;
          })
        : [
            {
              id: 'field-fast-sig',
              type: 'SIGNATURE' as const,
              page: targetPage,
              x: targetSigX,
              y: targetSigY,
              width: targetWidth,
              height: targetHeight,
              value: signatureDataUrl,
              label: 'Client Signature',
              required: true,
            },
            {
              id: 'field-fast-date',
              type: 'DATE' as const,
              page: targetPage,
              x: contract?.dateX ?? targetSigX,
              y: contract?.dateY ?? Math.max(targetSigY - 35, 20),
              width: 110,
              height: 28,
              value: today,
              label: 'Date Signed',
              required: true,
            },
          ];

      const hasSigInBase = baseFields.some((f) => f.type === 'SIGNATURE');
      const submissionFields = hasSigInBase
        ? baseFields
        : [
            ...baseFields,
            {
              id: 'field-fast-sig',
              type: 'SIGNATURE' as const,
              page: targetPage,
              x: targetSigX,
              y: targetSigY,
              width: targetWidth,
              height: targetHeight,
              value: signatureDataUrl,
              label: 'Client Signature',
              required: true,
            },
          ];

      const res = await fetch('/api/contracts/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          clientName: signerName.trim(),
          signatureDataUrl,
          signatureMethod: 'DRAW',
          page: targetPage,
          signatureX: targetSigX,
          signatureY: targetSigY,
          nameX: targetSigX,
          nameY: Math.max(targetSigY - 18, 20),
          dateX: contract?.dateX ?? targetSigX,
          dateY: contract?.dateY ?? Math.max(targetSigY - 35, 20),
          placement: {
            page: targetPage,
            signatureX: targetSigX,
            signatureY: targetSigY,
            nameX: targetSigX,
            nameY: Math.max(targetSigY - 18, 20),
            dateX: contract?.dateX ?? targetSigX,
            dateY: contract?.dateY ?? Math.max(targetSigY - 35, 20),
          },
          fields: submissionFields,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.alreadySigned) {
          setFetchError('ALREADY_SIGNED');
        } else {
          setValidationError(data.error || 'Failed to finalize contract. Please try again.');
        }
        setShowAreYouSureModal(false);
        setIsFinalizing(false);
        return;
      }

      if (data.status === 'WAITING_COUNTER_SIGN' || data.isWaitingCounterSign) {
        setIsWaitingCounterSign(true);
      }

      setFinalSuccessData({
        contractId: data.contractId,
        contractTitle: data.contractTitle,
        clientName: data.clientName,
        signedAt: data.signedAt,
        downloadUrl: data.downloadUrl,
      });
      setShowAreYouSureModal(false);
    } catch {
      setValidationError('A network error occurred while submitting your signature.');
      setShowAreYouSureModal(false);
    } finally {
      setIsFinalizing(false);
    }
  };

  // If contract finalized in this session
  if (finalSuccessData) {
    return (
      <SigningSuccess
        contractTitle={finalSuccessData.contractTitle}
        clientName={finalSuccessData.clientName}
        signedAt={finalSuccessData.signedAt}
        contractId={finalSuccessData.contractId}
        downloadUrl={finalSuccessData.downloadUrl}
        isWaitingCounterSign={isWaitingCounterSign}
      />
    );
  }

  // Handle loading and edge case errors
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-neutral-600">Opening contract document...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <SigningErrorState
        type={fetchError}
        signedAt={contract?.signedAt}
        onRefresh={fetchError === 'ERROR' ? fetchContract : undefined}
      />
    );
  }

  if (!contract || !pdfBase64) return null;

  return (
    <div className="h-screen w-screen bg-white flex flex-col text-black overflow-hidden select-none">
      {/* Top Header: Immediate Access with Legal Name & Trust Indicator */}
      <header className="flex-shrink-0 border-b border-neutral-300 bg-white px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0 shrink">
          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-black shrink-0" aria-hidden="true" />
          <span className="font-bold tracking-tight text-xs sm:text-sm text-black shrink-0">SignFlow</span>
          <span className="text-neutral-300 shrink-0" aria-hidden="true">|</span>
          <span className="text-[11px] sm:text-xs text-neutral-700 font-medium truncate max-w-[100px] xs:max-w-[130px] sm:max-w-xs" title={contract.title}>
            {contract.title}
          </span>
          {(contract.ownerName || contract.ownerEmail) && (
            <span className="hidden lg:inline-flex items-center space-x-1 px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-600 text-[10px] shrink-0">
              <span>Sent by:</span>
              <strong className="text-black font-semibold">{contract.ownerName || contract.ownerEmail}</strong>
            </span>
          )}
          {signatureDataUrl && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 text-black text-[10px] font-mono font-bold tracking-wider uppercase shrink-0">
              <CheckIcon className="w-3 h-3 text-black" />
              <span>SIGNED</span>
            </span>
          )}
        </div>

        {/* Legal Signer Name Input Bar */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <label htmlFor="signer-name-header" className="text-[11px] font-bold uppercase text-neutral-600 hidden md:inline">
            Legal Signer:
          </label>
          <input
            id="signer-name-header"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Legal Name"
            aria-label="Your Full Legal Name"
            className="text-[11px] sm:text-xs px-2 py-1 bg-neutral-50 border border-neutral-300 text-black font-medium focus:border-black focus:outline-none w-28 xs:w-36 sm:w-48 truncate"
          />
          <div className="hidden lg:flex items-center space-x-1.5 text-[11px] text-neutral-500 font-mono ml-2">
            <LockIcon className="w-3.5 h-3.5" />
            <span>256-Bit Encrypted</span>
          </div>
        </div>
      </header>

      {/* Sender Identity Subheader on smaller screens */}
      {(contract.ownerName || contract.ownerEmail) && (
        <div className="lg:hidden flex-shrink-0 bg-neutral-50 border-b border-neutral-200 px-3 py-1 text-[11px] text-neutral-600 flex items-center justify-between">
          <span>Contract sent by: <strong className="text-black">{contract.ownerName || contract.ownerEmail}</strong></span>
          {contract.ownerEmail && (
            <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[130px]">{contract.ownerEmail}</span>
          )}
        </div>
      )}

      {/* Validation Banner if user tried to complete without signing */}
      {validationError && !showAreYouSureModal && (
        <div className="flex-shrink-0 bg-neutral-900 text-white text-xs px-4 py-2 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <WarningIcon className="w-4 h-4 text-white shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-white hover:underline text-[11px] font-mono shrink-0 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Full-Screen Interactive Fast Signer (No Step Wizards) */}
      <main className="flex-1 w-full h-full min-h-0 relative overflow-hidden">
        <InteractiveFastSigner
          pdfBase64={pdfBase64}
          contractTitle={contract.title}
          designatedPage={contract.signaturePage}
          designatedX={contract.signatureX}
          designatedY={contract.signatureY}
          signatureDataUrl={signatureDataUrl}
          onSignatureChange={handleSignatureChange}
          onProceedToSign={handleOpenConfirmation}
        />
      </main>

      {/* Refined Compact Confirmation Modal */}
      <Modal
        isOpen={showAreYouSureModal}
        onClose={() => {
          if (!isFinalizing) setShowAreYouSureModal(false);
        }}
        title="Confirm Signature"
        maxWidth="sm"
      >
        <div className="space-y-3.5 text-black text-xs font-sans">
          {/* Sender Identity Info */}
          {(contract.ownerName || contract.ownerEmail) && (
            <div className="p-2.5 bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-700">
              <span className="text-neutral-500">Contract sent by: </span>
              <strong className="text-black font-semibold">{contract.ownerName || contract.ownerEmail}</strong>
              {contract.ownerEmail && contract.ownerName && (
                <span className="text-neutral-400 font-mono text-[10px] ml-1">({contract.ownerEmail})</span>
              )}
            </div>
          )}

          {/* Signer Legal Name Input */}
          <div>
            <label htmlFor="modal-signer-name" className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 block mb-1">
              Full Legal Name
            </label>
            <input
              id="modal-signer-name"
              type="text"
              value={signerName}
              onChange={(e) => {
                setSignerName(e.target.value);
                if (e.target.value.trim()) setValidationError(null);
              }}
              placeholder="Your full legal name"
              className="w-full text-xs px-3 py-2 bg-neutral-50 border border-neutral-300 font-semibold text-black focus:border-black focus:bg-white focus:outline-none"
            />
          </div>

          {/* Compact Signature Preview */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 block mb-1">
              Your Drawn Signature
            </label>
            <div className="h-20 border border-dashed border-neutral-400 bg-neutral-50 flex items-center justify-center p-2">
              {signatureDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureDataUrl}
                  alt="Drawn Signature Preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-neutral-400 text-xs">No signature recorded</span>
              )}
            </div>
          </div>

          {/* Clean 1-Line Agreement Checkbox */}
          <div className="p-2.5 border border-neutral-300 bg-white">
            <label className="flex items-start space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  if (e.target.checked) setValidationError(null);
                }}
                className="mt-0.5 w-4 h-4 rounded-none border border-black accent-black focus:ring-black cursor-pointer"
              />
              <span className="text-xs text-neutral-800 leading-snug font-medium">
                I agree to the contract terms and confirm this is my legally binding signature.
              </span>
            </label>
          </div>

          {validationError && (
            <div className="p-2 border border-black bg-neutral-100 text-[11px] font-semibold text-black" role="alert">
              {validationError}
            </div>
          )}

          {/* Action Buttons: Always Visible */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
            <button
              type="button"
              disabled={isFinalizing}
              onClick={() => setShowAreYouSureModal(false)}
              className="flex-1 py-2.5 px-3 border border-neutral-300 hover:border-black text-xs font-semibold text-black text-center cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!agreedToTerms || isFinalizing}
              onClick={handleFinalSubmit}
              className={`flex-1 py-2.5 px-3 bg-black text-white text-xs font-bold uppercase tracking-wider text-center transition-colors border border-black ${
                !agreedToTerms || isFinalizing
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-neutral-800 cursor-pointer shadow-sm'
              }`}
            >
              {isFinalizing ? 'Sealing...' : 'Confirm & Sign ✓'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Consumer Electronic Record & Signature Disclosure Modal */}
      <Modal
        isOpen={showDisclosureModal}
        onClose={() => setShowDisclosureModal(false)}
        title="Electronic Record & Signature Disclosure"
      >
        <div className="space-y-4 text-xs text-neutral-700 max-h-[60vh] overflow-y-auto pr-1">
          <p className="font-semibold text-black">
            Pursuant to the Electronic Signatures in Global and National Commerce Act (ESIGN) and Uniform Electronic Transactions Act (UETA).
          </p>

          <div className="p-3 bg-neutral-100 border border-neutral-300 space-y-1 text-[11px] text-neutral-800">
            <p><strong>Legal Validity:</strong> Electronic signatures executed through SignFlow have the exact same legal weight and enforceability as manual ink signatures on paper.</p>
            <p><strong>Cryptographic Non-Repudiation:</strong> All executions receive a tamper-evident SHA-256 cryptographic digest, UTC timestamps, and audit verification.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-black uppercase text-[11px] tracking-wider">1. Consent to Electronic Execution</h4>
            <p>
              By proceeding, you consent to conduct this transaction electronically and receive documents in electronic format.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-black uppercase text-[11px] tracking-wider">2. Record Retention</h4>
            <p>
              Upon completing this transaction, you will immediately have access to download and retain an immutable, cryptographically sealed copy of the signed contract.
            </p>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-200">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDisclosureModal(false)}
            >
              Understood &amp; Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
