'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SignaturePlacementViewer } from '@/components/signing/SignaturePlacementViewer';
import { ProgressBar } from '@/components/signing/ProgressBar';
import { SigningErrorState } from '@/components/signing/SigningErrorState';
import { SigningSuccess } from '@/components/signing/SigningSuccess';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LockIcon, DocumentIcon } from '@/components/ui/Icons';
import { PlacedField } from '@/lib/types';

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
  fields?: PlacedField[];
  requiresCounterSign?: boolean;
}

interface SigningFlowProps {
  token: string;
}

export function SigningFlow({ token }: SigningFlowProps) {
  // Streamlined 3-step in-situ flow: 1 = Intro, 2 = Review & Sign, 3 = Confirm & Finalize
  const [currentStep, setCurrentStep] = useState<number>(1);
  const steps = ['Introduction', 'Review & Sign', 'Confirm & Finalize'];

  // Contract data state
  const [contract, setContract] = useState<ContractData | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<'EXPIRED' | 'REVOKED' | 'ALREADY_SIGNED' | 'NOT_FOUND' | 'ERROR' | 'WAITING_COUNTER_SIGN' | null>(null);

  // Form & In-situ state
  const [signerName, setSignerName] = useState<string>('');
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [initialsDataUrl, setInitialsDataUrl] = useState<string | null>(null);
  const [signatureMethod, setSignatureMethod] = useState<'DRAW' | 'TYPE'>('DRAW');
  const [confirmationChecked, setConfirmationChecked] = useState<boolean>(false);
  const [isWaitingCounterSign, setIsWaitingCounterSign] = useState<boolean>(false);

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
      if (data.contract.status === 'SIGNED' || data.contract.status === 'WAITING_COUNTER_SIGN') {
        setContract(data.contract);
        setFetchError(data.contract.status === 'WAITING_COUNTER_SIGN' ? 'WAITING_COUNTER_SIGN' : 'ALREADY_SIGNED');
        return;
      }

      setContract(data.contract);
      setPdfBase64(data.pdfBase64);

      const clientName = data.contract.clientName || '';
      setSignerName(clientName);

      // Synthesize default in-situ anchors if no explicit multi-fields were configured
      const defaultFields: PlacedField[] = [
        {
          id: 'field-sig-primary',
          type: 'SIGNATURE',
          page: data.contract.signaturePage || 1,
          x: data.contract.signatureX ?? 70,
          y: data.contract.signatureY ?? 115,
          width: 170,
          height: 50,
          label: 'Client Signature',
          required: true,
        },
        {
          id: 'field-date-primary',
          type: 'DATE',
          page: data.contract.signaturePage || 1,
          x: data.contract.dateX ?? (data.contract.signatureX ?? 70),
          y: data.contract.dateY ?? Math.max((data.contract.signatureY ?? 115) - 30, 25),
          width: 110,
          height: 28,
          label: 'Date Signed',
          required: true,
        },
      ];

      if (data.contract.fields && data.contract.fields.length > 0) {
        // Ensure at least one SIGNATURE field exists
        const hasSig = data.contract.fields.some((f: PlacedField) => f.type === 'SIGNATURE');
        if (!hasSig) {
          setFields([...data.contract.fields, defaultFields[0]]);
        } else {
          setFields(data.contract.fields);
        }
      } else {
        setFields(defaultFields);
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

  // Check if primary signature is completed
  const hasAppliedSignature = Boolean(
    signatureDataUrl || fields.some((f) => f.type === 'SIGNATURE' && Boolean(f.value))
  );

  const handleProceedToFinalReview = () => {
    if (!signerName.trim()) {
      setValidationError('Please enter your full legal name before proceeding.');
      return;
    }
    if (!hasAppliedSignature) {
      setValidationError('Please tap the designated signature anchor on the document to apply your signature.');
      return;
    }
    // Verify all required fields (excluding DATE which auto-populates upon signature)
    const missingRequired = fields.filter(
      (f) => f.required !== false && f.type !== 'DATE' && !f.value
    );
    if (missingRequired.length > 0) {
      const missingLabels = missingRequired
        .map((f) => f.label || (f.type === 'SIGNATURE' ? 'Signature' : f.type === 'INITIALS' ? 'Initials' : f.type))
        .join(', ');
      setValidationError(`Please complete all required fields (${missingLabels}) before proceeding.`);
      return;
    }
    setValidationError(null);
    setCurrentStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!confirmationChecked) {
      setValidationError('You must confirm that you reviewed the contract before finalizing.');
      return;
    }

    setIsFinalizing(true);
    setValidationError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const activeSigUrl =
        signatureDataUrl ||
        fields.find((f) => f.type === 'SIGNATURE' && f.value)?.value ||
        null;

      const signedSigField =
        fields.find((f) => f.type === 'SIGNATURE' && f.value) ||
        fields.find((f) => f.type === 'SIGNATURE');
      const primaryDate = fields.find((f) => f.type === 'DATE');

      // Resolve final fields ensuring DATE is populated
      const resolvedFields = fields.map((f) => {
        if (f.type === 'DATE' && !f.value) {
          return { ...f, value: today };
        }
        if (f.type === 'SIGNATURE' && !f.value && activeSigUrl) {
          return { ...f, value: activeSigUrl };
        }
        return f;
      });

      const activeInitialsUrl =
        initialsDataUrl ||
        fields.find((f) => f.type === 'INITIALS' && f.value)?.value ||
        undefined;

      const res = await fetch('/api/contracts/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          clientName: signerName.trim(),
          signatureDataUrl: activeSigUrl,
          signatureMethod,
          page: signedSigField?.page || contract?.signaturePage || 1,
          signatureX: signedSigField?.x ?? contract?.signatureX ?? 70,
          signatureY: signedSigField?.y ?? contract?.signatureY ?? 115,
          nameX: signedSigField?.x ?? contract?.nameX ?? 70,
          nameY: Math.max((signedSigField?.y ?? contract?.signatureY ?? 115) - 18, 20),
          dateX: primaryDate?.x ?? contract?.dateX ?? 70,
          dateY: primaryDate?.y ?? contract?.dateY ?? 85,
          placement: {
            page: signedSigField?.page || contract?.signaturePage || 1,
            signatureX: signedSigField?.x ?? contract?.signatureX ?? 70,
            signatureY: signedSigField?.y ?? contract?.signatureY ?? 115,
            nameX: signedSigField?.x ?? contract?.nameX ?? 70,
            nameY: Math.max((signedSigField?.y ?? contract?.signatureY ?? 115) - 18, 20),
            dateX: primaryDate?.x ?? contract?.dateX ?? 70,
            dateY: primaryDate?.y ?? contract?.dateY ?? 85,
          },
          fields: resolvedFields,
          initialsDataUrl: activeInitialsUrl,
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
        isWaitingCounterSign={isWaitingCounterSign}
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

  const totalRequired = fields.filter((f) => f.required !== false).length;
  const completedRequired = fields.filter((f) => f.required !== false && Boolean(f.value)).length;
  const primarySigField = fields.find((f) => f.type === 'SIGNATURE');
  const activeSigPreview = signatureDataUrl || primarySigField?.value || null;

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
          <span className="hidden sm:inline">Secure in-situ signing session</span>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="max-w-4xl mx-auto w-full px-4 pt-6">
        <ProgressBar currentStep={currentStep} steps={steps} />
      </div>

      {/* Main Signing Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
        {/* Step 1: Introduction Screen */}
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
                <li>Review the complete contract document.</li>
                <li>Tap directly on the designated signature target to ink your signature in-place.</li>
                <li>Verify your details and finalize the legally binding agreement.</li>
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
              START REVIEWING & SIGNING →
            </Button>
          </div>
        )}

        {/* Step 2: In-Situ Document Signing (Approach B: Direct Tap-to-Ink) */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 lg:h-[calc(100vh-12rem)] lg:min-h-[460px] lg:max-h-[calc(100vh-12rem)]">
            {/* Main Interactive In-Situ PDF Canvas */}
            <div className="lg:col-span-8 flex flex-col h-[65vh] lg:h-full min-h-0 overflow-hidden">
              {pdfBase64 ? (
                <SignaturePlacementViewer
                  pdfBase64={pdfBase64}
                  fields={fields}
                  onFieldsChange={setFields}
                  signerName={signerName}
                  onSignerNameChange={setSignerName}
                  signatureDataUrl={signatureDataUrl}
                  onSignatureChange={setSignatureDataUrl}
                  initialsDataUrl={initialsDataUrl}
                  onInitialsChange={setInitialsDataUrl}
                  signatureMethod={signatureMethod}
                  onSignatureMethodChange={setSignatureMethod}
                  defaultPlacementPage={contract.signaturePage}
                />
              ) : (
                <div className="flex-1 border border-neutral-300 flex items-center justify-center text-xs text-neutral-500 bg-neutral-50">
                  Document preview unavailable.
                </div>
              )}
            </div>

            {/* Sidebar Guide & Action Panel */}
            <div className="lg:col-span-4 flex flex-col border border-neutral-300 p-6 bg-neutral-50 lg:self-start lg:sticky lg:top-4 lg:max-h-full lg:overflow-y-auto space-y-5">
              <div className="border-b border-neutral-200 pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-black">Step 2 of 3: Review & Sign</h2>
                  <span className="text-[10px] font-mono bg-black text-white px-1.5 py-0.5 uppercase">
                    Tap-to-Ink
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Tap directly on the highlighted boxes on the document to apply your signature.
                </p>
              </div>

              {/* Legal Signer Name Field */}
              <div>
                <Input
                  label="Signer Legal Full Name"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  helperText="Your legal name as recorded on the executed agreement."
                />
              </div>

              {/* In-Situ Progress Checklist */}
              <div className="p-3 bg-white border border-neutral-300 text-xs space-y-2">
                <div className="font-semibold text-black uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Document Signing Checklist</span>
                  <span className="text-[10px] font-mono bg-neutral-100 border border-neutral-300 px-1.5 py-0.5">
                    {completedRequired} / {totalRequired || fields.length} Done
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {fields.map((f) => {
                    const isDone = Boolean(f.value);
                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 last:border-0"
                      >
                        <span className="text-neutral-700 font-medium">
                          {f.label || f.type} (P.{f.page})
                        </span>
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 ${
                            isDone
                              ? 'bg-black text-white'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                          }`}
                        >
                          {isDone ? '✓ SIGNED' : '✍ PENDING'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {validationError && (
                <div className="p-3 border border-black bg-neutral-50 text-xs font-medium text-black" role="alert">
                  <span className="font-bold underline mr-1">Please note:</span>
                  {validationError}
                </div>
              )}

              {/* Proceed Action Button */}
              <div className="pt-2 border-t border-neutral-200 space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleProceedToFinalReview}
                >
                  CONTINUE TO CONFIRM & EXECUTE →
                </Button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full text-xs text-neutral-600 hover:text-black underline text-center cursor-pointer"
                >
                  ← Back to Overview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Final Review & Confirmation */}
        {currentStep === 3 && (
          <div className="max-w-2xl mx-auto w-full border border-neutral-300 p-6 sm:p-8 bg-white space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <h2 className="text-lg font-bold text-black">Step 3 of 3: Final Review & Confirm</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Please double check your details and confirm your electronic agreement to finalize execution.
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
                  {signatureMethod === 'DRAW' ? 'Handwritten Touch / Ink Canvas' : 'Typed Calligraphic Representation'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block">Fields Executed:</span>
                <span className="font-mono text-neutral-800">
                  {fields.length} document fields bound in-situ directly on the document.
                </span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block mb-1">Applied Signature Preview:</span>
                <div className="h-24 border border-neutral-300 bg-white flex items-center justify-center p-2">
                  {activeSigPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeSigPreview}
                      alt="Signature preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">Signature not recorded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tamper-Evident Seal & Legal Audit Record callout */}
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
                    <span className="text-[11px] text-neutral-500">Signer telemetry, UTC timestamp, and compliance metadata are embedded directly inside the file.</span>
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
                  . I confirm that I have reviewed the contract, applied my signature at the designated location, and intend for this electronic signature to be legally binding under the ESIGN Act and UETA.
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
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                ← Back to Document
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
                FINALIZE & SIGN CONTRACT ✓
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
        title="Confirm Your Signature"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            You are about to complete and sign this agreement. Your electronic signature will be placed onto the document in-place, and a verified signed copy will be generated.
          </p>

          <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs space-y-1">
            <div><span className="font-semibold">Signer:</span> {signerName}</div>
            <div><span className="font-semibold">Contract:</span> {contract.title}</div>
            <div><span className="font-semibold">Security Verification:</span> Cryptographic SHA-256 Digest + Embedded Audit Record</div>
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
              loadingText="Finalizing your signed document..."
            >
              YES, SIGN DOCUMENT
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
