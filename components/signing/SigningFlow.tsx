'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PdfViewer } from '@/components/pdf/PdfViewer';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { TypedSignature } from '@/components/signature/TypedSignature';
import { ProgressBar } from '@/components/signing/ProgressBar';
import { SigningErrorState } from '@/components/signing/SigningErrorState';
import { SigningSuccess } from '@/components/signing/SigningSuccess';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LockIcon, DocumentIcon, WarningIcon } from '@/components/ui/Icons';

interface ContractData {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: string;
  expiresAt: string;
  signedAt?: string;
  message?: string;
}

interface SigningFlowProps {
  token: string;
}

export function SigningFlow({ token }: SigningFlowProps) {
  // Step definitions: 1 = Intro, 2 = Review Document, 3 = Provide Information & Signature, 4 = Final Review
  const [currentStep, setCurrentStep] = useState<number>(1);
  const steps = ['Introduction', 'Review Document', 'Signature', 'Confirm & Sign'];

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

  // Validation & Finalization states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showFinalModal, setShowFinalModal] = useState<boolean>(false);
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

  const handleProceedToReview = () => {
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
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
                <li>Enter your legal name</li>
                <li>Draw or type your legal electronic signature</li>
                <li>Review and execute the finalized contract</li>
              </ol>
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
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-[600px]">
            {/* Prominent PDF viewer */}
            <div className="lg:col-span-8 flex flex-col h-full min-h-[500px]">
              {pdfBase64 ? (
                <PdfViewer pdfBase64={pdfBase64} />
              ) : (
                <div className="flex-1 border border-neutral-300 flex items-center justify-center text-xs text-neutral-500">
                  Document preview unavailable.
                </div>
              )}
            </div>

            {/* Sidebar Instructions & Action */}
            <div className="lg:col-span-4 flex flex-col justify-between border border-neutral-300 p-6 bg-neutral-50">
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

              <div className="pt-6 border-t border-neutral-200 space-y-3">
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
              <Button variant="primary" onClick={handleProceedToReview}>
                Review & Confirm →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Final Review & Confirmation */}
        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto w-full border border-neutral-300 p-6 sm:p-8 bg-white space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-bold text-black">Review Before Final Signing</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Please verify that your information and signature are correct before confirming.
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

            {/* Confirmation Checkbox */}
            <div className="p-4 border border-neutral-300 bg-white">
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
                  I confirm that I have reviewed the contract and that the information and signature I provided are correct.
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
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                ← Edit Information
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
            You are about to finalize this contract. After confirmation, your signature and submitted information cannot be changed.
          </p>

          <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs space-y-1">
            <div><span className="font-semibold">Signer:</span> {signerName}</div>
            <div><span className="font-semibold">Contract:</span> {contract.title}</div>
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
              loadingText="Finalizing your contract..."
            >
              CONFIRM & SIGN
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
