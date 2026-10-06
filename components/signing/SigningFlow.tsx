'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PdfViewer } from '@/components/pdf/PdfViewer';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { TypedSignature } from '@/components/signature/TypedSignature';
import { SignaturePlacementViewer } from '@/components/signing/SignaturePlacementViewer';
import { ProgressBar } from '@/components/signing/ProgressBar';
import { SigningErrorState } from '@/components/signing/SigningErrorState';
import { SigningSuccess } from '@/components/signing/SigningSuccess';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LockIcon, DocumentIcon } from '@/components/ui/Icons';
import { SignaturePlacement } from '@/lib/types';

interface ContractData {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
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
}

interface SigningFlowProps {
  token: string;
}

export function SigningFlow({ token }: SigningFlowProps) {
  // Step definitions: 1 = Intro, 2 = Review Document, 3 = Signature, 4 = Place Signature, 5 = Confirm & Sign
  const [currentStep, setCurrentStep] = useState<number>(1);
  const steps = ['Introduction', 'Review Document', 'Signature', 'Place Signature', 'Confirm & Sign'];

  // Contract data state
  const [contract, setContract] = useState<ContractData | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<'EXPIRED' | 'REVOKED' | 'ALREADY_SIGNED' | 'NOT_FOUND' | 'ERROR' | null>(null);

  // Form inputs
  const [signerName, setSignerName] = useState<string>('');
  const [signatureMethod, setSignatureMethod] = useState<'DRAW' | 'TYPE'>('DRAW');
  const [drawnSignatureDataUrl, setDrawnSignatureDataUrl] = useState<string | null>(null);
  const [typedSignatureDataUrl, setTypedSignatureDataUrl] = useState<string | null>(null);
  const [confirmationChecked, setConfirmationChecked] = useState<boolean>(false);

  // Placement state
  const [placement, setPlacement] = useState<SignaturePlacement>({
    page: 1,
    signatureX: 70,
    signatureY: 115,
    nameX: 70,
    nameY: 97,
    dateX: 70,
    dateY: 85,
  });

  // Validation & Finalization states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showFinalModal, setShowFinalModal] = useState<boolean>(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
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
      if (data.contract.status === 'SIGNED') {
        setContract(data.contract);
        setFetchError('ALREADY_SIGNED');
        return;
      }

      setContract(data.contract);
      setSignerName(data.contract.clientName || '');
      setPdfBase64(data.pdfBase64);

      if (data.contract.signaturePage || data.contract.signatureX || data.contract.signatureY) {
        setPlacement({
          page: data.contract.signaturePage || 1,
          signatureX: data.contract.signatureX ?? 70,
          signatureY: data.contract.signatureY ?? 115,
          nameX: data.contract.nameX ?? (data.contract.signatureX ?? 70),
          nameY: data.contract.nameY ?? Math.max((data.contract.signatureY ?? 115) - 18, 40),
          dateX: data.contract.dateX ?? (data.contract.nameX ?? (data.contract.signatureX ?? 70)),
          dateY: data.contract.dateY ?? Math.max((data.contract.signatureY ?? 115) - 30, 25),
        });
      }
    } catch {
      setFetchError('ERROR');
    } finally {
      setLoadingInitial(false);
    }
  }, [token]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const activeSignatureDataUrl = signatureMethod === 'DRAW' ? drawnSignatureDataUrl : typedSignatureDataUrl;

  const handleProceedToSignature = () => {
    setCurrentStep(3);
  };

  const handleProceedToPlacement = () => {
    if (!signerName.trim()) {
      setValidationError('Please enter your full legal name.');
      return;
    }
    if (!activeSignatureDataUrl) {
      setValidationError('Please add your signature before continuing.');
      return;
    }
    setValidationError(null);
    setCurrentStep(4);
  };

  const handleFinalSubmit = async () => {
    if (!confirmationChecked) {
      setValidationError('You must confirm that you reviewed the contract before signing.');
      return;
    }

    setIsFinalizing(true);
    setValidationError(null);

    try {
      const res = await fetch('/api/contracts/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          clientName: signerName.trim(),
          signatureDataUrl: activeSignatureDataUrl,
          signatureMethod,
          page: placement.page,
          signatureX: placement.signatureX,
          signatureY: placement.signatureY,
          nameX: placement.nameX,
          nameY: placement.nameY,
          dateX: placement.dateX,
          dateY: placement.dateY,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.alreadySigned) {
          setFetchError('ALREADY_SIGNED');
        } else {
          setValidationError(data.error || 'Failed to finalize contract. Please try again.');
        }
        setShowFinalModal(false);
        setIsFinalizing(false);
        return;
      }

      setFinalSuccessData({
        contractId: data.contractId,
        contractTitle: data.contractTitle,
        clientName: data.clientName,
        signedAt: data.signedAt,
        downloadUrl: data.downloadUrl,
      });
      setShowFinalModal(false);
    } catch {
      setValidationError('A network error occurred while submitting your signature.');
      setShowFinalModal(false);
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
      />
    );
  }

  // Handle loading and edge case errors
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-neutral-600">Loading secure signing session...</p>
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

  if (!contract) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col text-black">
      {/* Top Header with Trust Indicator */}
      <header className="border-b border-neutral-200 bg-white py-3 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-black" aria-hidden="true" />
          <span className="font-bold tracking-tight text-sm text-black">SignFlow</span>
          <span className="text-neutral-300">|</span>
          <span className="text-xs text-neutral-600 font-medium truncate max-w-xs sm:max-w-md">
            {contract.title}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-neutral-600">
          <LockIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Secure signing session</span>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="max-w-4xl mx-auto w-full px-4 pt-6">
        <ProgressBar currentStep={currentStep} steps={steps} />
      </div>

      {/* Main Signing Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
        {/* Step 1: Introduction */}
        {currentStep === 1 && (
          <div className="max-w-xl mx-auto my-auto w-full border border-neutral-300 p-8 text-center bg-white space-y-6">
            <div className="w-12 h-12 bg-neutral-100 border border-neutral-300 mx-auto flex items-center justify-center">
              <DocumentIcon className="w-6 h-6 text-black" />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-black">{contract.title}</h1>
              <p className="text-xs text-neutral-500 mt-1">
                Please review the entire agreement carefully before providing your signature.
              </p>
            </div>

            {contract.message && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 italic text-left">
                &ldquo;{contract.message}&rdquo;
              </div>
            )}

            <div className="p-4 bg-neutral-50 border border-neutral-200 text-xs text-left space-y-2">
              <div className="font-semibold text-black uppercase tracking-wider text-[11px]">
                Estimated Signing Steps:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-neutral-700">
                <li>Review the complete contract document</li>
                <li>Provide your legal name and electronic signature</li>
                <li>Position your signature interactively on the document</li>
                <li>Review and execute the finalized contract</li>
              </ol>
            </div>

            {/* ESIGN & UETA Consumer Electronic Record Disclosure Notice */}
            <div className="p-3 border border-neutral-200 bg-neutral-50/50 text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-black text-[11px] uppercase tracking-wider">
                  Electronic Record & Signature Disclosure
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">ESIGN &bull; UETA Compliant</span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-normal">
                By signing, you agree to conduct business electronically. Your electronic signature carries the full legal weight and validity of a handwritten ink signature.
              </p>
              <button
                type="button"
                onClick={() => setShowDisclosureModal(true)}
                className="text-[11px] font-semibold text-black underline hover:text-neutral-700 cursor-pointer inline-block pt-0.5"
              >
                View Full Electronic Record & Signature Disclosure →
              </button>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setCurrentStep(2)}
            >
              START REVIEWING
            </Button>
          </div>
        )}

        {/* Step 2: Contract Viewer Screen */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 lg:h-[calc(100vh-12rem)] lg:min-h-[460px] lg:max-h-[calc(100vh-12rem)]">
            {/* Prominent PDF viewer */}
            <div className="lg:col-span-8 flex flex-col h-[65vh] lg:h-full min-h-0 overflow-hidden">
              {pdfBase64 ? (
                <PdfViewer pdfBase64={pdfBase64} />
              ) : (
                <div className="flex-1 border border-neutral-300 flex items-center justify-center text-xs text-neutral-500">
                  Document preview unavailable.
                </div>
              )}
            </div>

            {/* Sidebar Instructions & Action */}
            <div className="lg:col-span-4 flex flex-col border border-neutral-300 p-6 bg-neutral-50 lg:self-start lg:sticky lg:top-4 lg:max-h-full lg:overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="border-b border-neutral-200 pb-3">
                  <h2 className="text-base font-bold text-black">Step 1 of 3: Read Document</h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Review all terms and conditions above. You can navigate pages and adjust zoom.
                  </p>
                </div>

                <div className="text-xs space-y-2 text-neutral-600">
                  <p>• Ensure you agree to all specifications and legal clauses.</p>
                  <p>• Once ready, proceed to provide your legal signature.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleProceedToSignature}
                >
                  PROCEED TO SIGNATURE →
                </Button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full text-xs text-neutral-600 hover:text-black underline text-center cursor-pointer"
                >
                  ← Back to introduction
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Information & Signature Screen */}
        {currentStep === 3 && (
          <div className="max-w-2xl mx-auto w-full border border-neutral-300 p-6 sm:p-8 bg-white space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-bold text-black">Provide Signature Information</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Enter your legal name and choose how you would like to sign the agreement.
              </p>
            </div>

            {/* Full Name input */}
            <Input
              label="Full Legal Name"
              required
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Juan Dela Cruz"
              helperText="Enter your full legal name exactly as you want it to appear on the signed document."
            />

            {/* Signature Method Tabs */}
            <div className="space-y-3 pt-2">
              <label className="text-sm font-semibold text-black block">Signature</label>
              <div className="flex border-b border-neutral-300">
                <button
                  type="button"
                  onClick={() => setSignatureMethod('DRAW')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer border-b-2 transition-colors ${
                    signatureMethod === 'DRAW'
                      ? 'border-black text-black'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  Draw Signature
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMethod('TYPE')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer border-b-2 transition-colors ${
                    signatureMethod === 'TYPE'
                      ? 'border-black text-black'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  Type Signature
                </button>
              </div>

              {signatureMethod === 'DRAW' ? (
                <SignaturePad onSignatureChange={setDrawnSignatureDataUrl} />
              ) : (
                <TypedSignature
                  name={signerName}
                  onSignatureGenerated={setTypedSignatureDataUrl}
                />
              )}
            </div>

            {validationError && (
              <div className="p-3 border border-black bg-neutral-50 text-xs font-medium text-black" role="alert">
                <span className="font-bold underline mr-1">Attention:</span>
                {validationError}
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                ← Back to Document
              </Button>
              <Button variant="primary" onClick={handleProceedToPlacement}>
                Place Signature →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Visual Signature Placement Screen */}
        {currentStep === 4 && (
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 lg:h-[calc(100vh-12rem)] lg:min-h-[460px] lg:max-h-[calc(100vh-12rem)]">
            {/* Prominent PDF viewer with Draggable Signature Badge */}
            <div className="lg:col-span-8 flex flex-col h-[65vh] lg:h-full min-h-0 overflow-hidden">
              {pdfBase64 && activeSignatureDataUrl ? (
                <SignaturePlacementViewer
                  pdfBase64={pdfBase64}
                  signatureDataUrl={activeSignatureDataUrl}
                  signerName={signerName}
                  placement={placement}
                  onPlacementChange={setPlacement}
                  defaultPlacementPage={contract.signaturePage}
                />
              ) : (
                <div className="flex-1 border border-neutral-300 flex items-center justify-center text-xs text-neutral-500 bg-neutral-50">
                  Document preview unavailable.
                </div>
              )}
            </div>

            {/* Sidebar Instructions & Controls */}
            <div className="lg:col-span-4 flex flex-col border border-neutral-300 p-6 bg-neutral-50 lg:self-start lg:sticky lg:top-4 lg:max-h-full lg:overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="border-b border-neutral-200 pb-3">
                  <h2 className="text-base font-bold text-black">Step 3 of 4: Position Signature</h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Position your signature precisely where you want it on the contract (e.g. over the designated signature line).
                  </p>
                </div>

                {/* Placement Feedback Card */}
                <div className="p-3 bg-white border border-neutral-300 text-xs space-y-2">
                  <div className="font-semibold text-black uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <span>Signature Placement</span>
                    <div className="flex items-center gap-1.5">
                      {contract.signaturePage !== undefined && (
                        <span className="text-[9px] bg-black text-white px-1.5 py-0.5 font-sans font-bold">
                          Pre-Set by Sender
                        </span>
                      )}
                      <span className="text-[10px] bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 font-mono">
                        Page {placement.page}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-neutral-700 font-mono text-[11px] pt-1">
                    <div>X-Coord: <strong className="text-black font-sans">{placement.signatureX} pt</strong></div>
                    <div>Y-Coord: <strong className="text-black font-sans">{placement.signatureY} pt</strong></div>
                  </div>
                  <p className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 leading-tight">
                    {contract.signaturePage !== undefined
                      ? 'The document sender designated this location for your signature. You may verify or fine-tune it.'
                      : 'Your electronic signature will be stamped cleanly at this exact location.'}
                  </p>
                </div>

                <div className="text-xs space-y-2 text-neutral-600">
                  <p>• <strong>Drag to position:</strong> Grab the signature badge with your mouse or finger to move it.</p>
                  <p>• <strong>Tap to place:</strong> Tap anywhere on the contract page to instantly jump your signature there.</p>
                  <p>• <strong>Page navigation:</strong> Use the toolbar arrows to place your signature on any page.</p>
                  <p>• <strong>Arrow keys:</strong> Use your keyboard arrows for fine millimeter adjustments.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => setCurrentStep(5)}
                >
                  REVIEW & CONFIRM →
                </Button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="w-full text-xs text-neutral-600 hover:text-black underline text-center cursor-pointer"
                >
                  ← Back to signature information
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Final Review & Confirmation */}
        {currentStep === 5 && (
          <div className="max-w-2xl mx-auto w-full border border-neutral-300 p-6 sm:p-8 bg-white space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-bold text-black">Review Before Final Signing</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Please verify that your information, signature, and placement are correct before confirming.
              </p>
            </div>

            <div className="p-4 bg-neutral-50 border border-neutral-200 text-xs space-y-3">
              <div>
                <span className="text-neutral-500 font-medium block">Contract:</span>
                <span className="font-bold text-black text-sm">{contract.title}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block">Signer Legal Name:</span>
                <span className="font-semibold text-black">{signerName}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block">Signature Method:</span>
                <span className="text-neutral-800">
                  {signatureMethod === 'DRAW' ? 'Handwritten Canvas' : 'Typed Electronic Representation'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block">Signature Placement:</span>
                <span className="font-mono text-neutral-800">
                  Page {placement.page} &bull; Coordinates: ({placement.signatureX} pt, {placement.signatureY} pt)
                </span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block mb-1">Signature Preview:</span>
                <div className="h-24 border border-neutral-300 bg-white flex items-center justify-center p-2">
                  {activeSignatureDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeSignatureDataUrl}
                      alt="Signature preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Tamper-Evident Seal & Certificate of Completion Details */}
            <div className="p-4 border border-black bg-white space-y-3">
              <div className="flex items-center space-x-2 border-b border-neutral-200 pb-2">
                <span className="w-2.5 h-2.5 bg-black" />
                <span className="text-xs font-bold text-black uppercase tracking-wider">
                  Tamper-Evident Security Seal & Embedded Audit Record
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-700">
                <div className="flex items-start space-x-2">
                  <span className="font-bold text-black font-mono">01.</span>
                  <div>
                    <span className="font-semibold text-black block">Cryptographic SHA-256 Digest</span>
                    <span className="text-[11px] text-neutral-500">Document integrity is cryptographically sealed upon submission.</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <span className="font-bold text-black font-mono">02.</span>
                  <div>
                    <span className="font-semibold text-black block">Embedded Verification Record</span>
                    <span className="text-[11px] text-neutral-500">Signer telemetry, contract ID, and compliance metadata are embedded directly inside the file.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmation & Electronic Consent Checkbox */}
            <div className="p-4 border border-neutral-300 bg-neutral-50/50 space-y-2">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmationChecked}
                  onChange={(e) => {
                    setConfirmationChecked(e.target.checked);
                    if (e.target.checked) setValidationError(null);
                  }}
                  className="mt-0.5 w-4 h-4 rounded-none border-black accent-black focus:ring-black"
                />
                <span className="text-xs text-neutral-800 leading-relaxed font-medium">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowDisclosureModal(true);
                    }}
                    className="font-bold text-black underline hover:text-neutral-600"
                  >
                    Consumer Electronic Record & Signature Disclosure
                  </button>
                  . I confirm that I have reviewed the contract, placed my signature at the designated location, and intend for this electronic signature to be legally binding under the ESIGN Act and UETA.
                </span>
              </label>
            </div>

            {validationError && (
              <div className="p-3 border border-black bg-neutral-50 text-xs font-medium text-black" role="alert">
                <span className="font-bold underline mr-1">Note:</span>
                {validationError}
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>
                ← Adjust Placement
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  if (!confirmationChecked) {
                    setValidationError('Please check the confirmation box before finalizing.');
                    return;
                  }
                  setShowFinalModal(true);
                }}
              >
                CONFIRM & SIGN
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Final Irreversible Confirmation Dialog */}
      <Modal
        isOpen={showFinalModal}
        onClose={() => {
          if (!isFinalizing) setShowFinalModal(false);
        }}
        title="Finalize Contract Execution"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            You are about to execute this contract. Your signature will be stamped on the contract, and an official court-admissible Certificate of Completion will be permanently sealed.
          </p>

          <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs space-y-1">
            <div><span className="font-semibold">Signer:</span> {signerName}</div>
            <div><span className="font-semibold">Contract:</span> {contract.title}</div>
            <div><span className="font-semibold">Security Seal:</span> Cryptographic SHA-256 + Certificate of Completion</div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
            <Button
              variant="outline"
              disabled={isFinalizing}
              onClick={() => setShowFinalModal(false)}
            >
              GO BACK
            </Button>
            <Button
              variant="primary"
              onClick={handleFinalSubmit}
              isLoading={isFinalizing}
              loadingText="Finalizing & sealing contract..."
            >
              CONFIRM & SIGN
            </Button>
          </div>
        </div>
      </Modal>

      {/* Consumer Electronic Record & Signature Disclosure Modal */}
      <Modal
        isOpen={showDisclosureModal}
        onClose={() => setShowDisclosureModal(false)}
        title="Consumer Electronic Record & Signature Disclosure"
      >
        <div className="space-y-4 text-xs text-neutral-700 max-h-[60vh] overflow-y-auto pr-1">
          <p className="font-semibold text-black">
            Please review this statutory Consumer Electronic Record & Signature Disclosure pursuant to the ESIGN Act and UETA.
          </p>

          <div className="p-3 bg-neutral-50 border border-neutral-200 space-y-1 text-[11px] text-neutral-600">
            <p><strong>Governing Statutes:</strong> Electronic Signatures in Global and National Commerce Act (ESIGN, 15 U.S.C. § 7001 et seq.) and Uniform Electronic Transactions Act (UETA).</p>
            <p><strong>Legal Validity:</strong> Electronic signatures executed through SignFlow have the exact same legal force and effect as manual handwritten ink signatures.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-black uppercase text-[11px] tracking-wider">1. Consent to Electronic Transactions</h4>
            <p>
              By proceeding with this electronic signature process, you affirmatively consent to conduct this transaction electronically and to receive documents and communications in electronic form.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-black uppercase text-[11px] tracking-wider">2. Right to Download & Retain Records</h4>
            <p>
              Upon completing this transaction, you will immediately receive access to download and retain an immutable, cryptographically sealed copy of the signed contract and its associated Certificate of Completion.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-black uppercase text-[11px] tracking-wider">3. Technical Requirements</h4>
            <p>
              To access and retain electronic records, you must have an active internet connection, a modern web browser (Google Chrome, Apple Safari, Mozilla Firefox, Microsoft Edge), and standard PDF viewing software.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-black uppercase text-[11px] tracking-wider">4. Cryptographic Evidence & Non-Repudiation</h4>
            <p>
              Each executed contract generates a court-admissible Certificate of Completion recording cryptographic SHA-256 hashes, timestamps in UTC, IP address telemetry, and user agent details to guarantee document integrity and non-repudiation.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-neutral-200">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDisclosureModal(false)}
            >
              UNDERSTOOD & CLOSE
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
