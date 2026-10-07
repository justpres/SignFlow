'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { DocumentIcon, CopyIcon, CheckIcon } from '@/components/ui/Icons';
import { AdminFieldPreparationModal } from '@/components/admin/AdminFieldPreparationModal';
import { ContractTemplate, PlacedField } from '@/lib/types';

function NewContractForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get('draftId');

  // Form states
  const [draftId, setDraftId] = useState<string | null>(draftIdParam);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [message, setMessage] = useState('Please review and sign this agreement.');
  const [requiresCounterSign, setRequiresCounterSign] = useState(false);
  const [signaturePage, setSignaturePage] = useState('');
  const [signatureX, setSignatureX] = useState('');
  const [signatureY, setSignatureY] = useState('');
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);

  // Template states
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState<string | null>(null);

  // Flow & submission states
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load available templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.warn('Failed to fetch templates:', e);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load existing draft if draftId is in query params
  useEffect(() => {
    if (!draftIdParam) return;
    async function loadDraft() {
      try {
        const res = await fetch(`/api/contracts/${draftIdParam}`);
        if (res.ok) {
          const data = await res.json();
          const draft = data.contract;
          setDraftId(draft.id);
          setTitle(draft.title || '');
          setClientName(draft.clientName || '');
          setClientEmail(draft.clientEmail || '');
          if (draft.expiresAt) {
            setExpiresAt(draft.expiresAt.split('T')[0]);
          }
          if (draft.message) setMessage(draft.message);
          if (draft.requiresCounterSign !== undefined) setRequiresCounterSign(draft.requiresCounterSign);
          if (draft.signaturePage) setSignaturePage(String(draft.signaturePage));
          if (draft.signatureX) setSignatureX(String(draft.signatureX));
          if (draft.signatureY) setSignatureY(String(draft.signatureY));
          if (draft.fields) setFields(draft.fields);
          if (draft.originalPdfBase64) {
            setFileBase64(draft.originalPdfBase64);
            try {
              const cleanB64 = draft.originalPdfBase64.replace(/^data:[^;]+;base64,/, '');
              const bin = atob(cleanB64);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const f = new File([bytes], `${draft.title || 'draft'}.pdf`, { type: 'application/pdf' });
              setFile(f);
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error('Failed to load draft:', err);
      }
    }
    loadDraft();
  }, [draftIdParam]);

  // Select a reusable template
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    setTitle(tpl.title);
    setFileBase64(tpl.pdfBase64);
    if (tpl.signaturePage) setSignaturePage(String(tpl.signaturePage));
    if (tpl.signatureX) setSignatureX(String(tpl.signatureX));
    if (tpl.signatureY) setSignatureY(String(tpl.signatureY));
    if (tpl.fields) setFields(tpl.fields);
    if (tpl.requiresCounterSign !== undefined) setRequiresCounterSign(tpl.requiresCounterSign);

    try {
      const cleanB64 = tpl.pdfBase64.replace(/^data:[^;]+;base64,/, '');
      const bin = atob(cleanB64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const f = new File([bytes], tpl.fileName || `${tpl.title}.pdf`, { type: 'application/pdf' });
      setFile(f);
    } catch {
      // ignore
    }
  };

  // Save current PDF as reusable template
  const handleSaveAsTemplate = async () => {
    if (!fileBase64) {
      setError('Please upload a PDF document first before saving as a template.');
      return;
    }

    const templateTitle = title.trim() || (file ? file.name.replace(/\.pdf$/i, '') : 'Contract Template');
    if (!title.trim()) {
      setTitle(templateTitle);
    }

    setIsSavingTemplate(true);
    setError(null);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: templateTitle,
          pdfBase64: fileBase64,
          fileName: file?.name || `${templateTitle}.pdf`,
          fields,
          signaturePage: signaturePage ? Number(signaturePage) : undefined,
          signatureX: signatureX ? Number(signatureX) : undefined,
          signatureY: signatureY ? Number(signatureY) : undefined,
          requiresCounterSign,
        }),
      });

      if (res.ok) {
        setTemplateSavedMsg('Saved as reusable template! You can now select it anytime.');
        setTimeout(() => setTemplateSavedMsg(null), 4000);
        loadTemplates();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save template.');
      }
    } catch {
      setError('Network error while saving template.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      setFile(null);
      setFileBase64(null);
      return;
    }

    if (selected.size > 20 * 1024 * 1024) {
      setError('File size must be under 20MB.');
      setFile(null);
      setFileBase64(null);
      return;
    }

    setError(null);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  // Save as Draft
  const handleSaveAsDraft = async () => {
    setIsSavingDraft(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('isDraft', 'true');
      if (draftId) formData.append('draftId', draftId);
      formData.append('title', title || (file ? file.name.replace(/\.pdf$/i, '') : 'Untitled Draft'));
      formData.append('clientName', clientName);
      formData.append('clientEmail', clientEmail);
      formData.append('expiresAt', expiresAt);
      formData.append('message', message);
      formData.append('requiresCounterSign', String(requiresCounterSign));
      if (file) formData.append('file', file);
      if (fileBase64) formData.append('fileBase64', fileBase64);
      if (signaturePage) formData.append('signaturePage', signaturePage);
      if (signatureX) formData.append('signatureX', signatureX);
      if (signatureY) formData.append('signatureY', signatureY);
      if (fields.length > 0) formData.append('fields', JSON.stringify(fields));

      const res = await fetch('/api/contracts', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save draft.');
      } else {
        setDraftId(data.contract.id);
        setDraftSavedMsg('Draft saved successfully! You can resume from the dashboard anytime.');
        setTimeout(() => {
          router.push('/admin');
        }, 1200);
      }
    } catch {
      setError('Network error while saving draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit / Send Contract
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !fileBase64) {
      setError('Please select a contract PDF to upload.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (draftId) formData.append('draftId', draftId);
      formData.append('title', title);
      formData.append('clientName', clientName);
      formData.append('clientEmail', clientEmail);
      formData.append('expiresAt', expiresAt);
      formData.append('message', message);
      formData.append('requiresCounterSign', String(requiresCounterSign));
      if (file) formData.append('file', file);
      if (fileBase64) formData.append('fileBase64', fileBase64);
      if (signaturePage) formData.append('signaturePage', signaturePage);
      if (signatureX) formData.append('signatureX', signatureX);
      if (signatureY) formData.append('signatureY', signatureY);
      if (fields.length > 0) formData.append('fields', JSON.stringify(fields));

      const res = await fetch('/api/contracts', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create contract.');
        setIsLoading(false);
        return;
      }

      setCreatedToken(data.signingToken);
      setCreatedContractId(data.contract.id);
      setIsLoading(false);

      if (typeof window !== 'undefined' && data.signingToken) {
        const fullSigningUrl = `${window.location.origin}/sign/${data.signingToken}`;
        try {
          await navigator.clipboard.writeText(fullSigningUrl);
          setCopied(true);
        } catch {
          // ignore
        }
      }
    } catch {
      setError('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const signingUrl = createdToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sign/${createdToken}`
    : '';

  const copyToClipboard = () => {
    if (!signingUrl) return;
    navigator.clipboard.writeText(signingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (createdToken) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <Card>
          <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-neutral-100">
            <div className="p-2 bg-black text-white">
              <CheckIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">Contract Created Successfully</h2>
              <p className="text-xs text-neutral-500">
                {requiresCounterSign
                  ? 'Two-party signing link is ready. After client signs, you will counter-sign to finalize.'
                  : 'A private signing link is ready for your client.'}
              </p>
            </div>
          </div>

          <div className="mb-6 p-3 bg-neutral-900 border border-black text-white text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 mr-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="font-medium truncate">
                {copied ? 'Signing link automatically copied to clipboard!' : 'Private client signing link generated.'}
              </span>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block mb-1">
                Client Signing URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={signingUrl}
                  className="w-full font-mono text-xs p-2.5 bg-neutral-50 border border-neutral-300 text-neutral-800 select-all"
                />
                <Button variant="outline" size="md" onClick={copyToClipboard} className="shrink-0 text-xs">
                  <CopyIcon className="w-4 h-4 mr-1.5" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-neutral-100">
            <Link
              href={`/admin/contracts/${createdContractId}`}
              className="text-xs font-semibold text-black underline"
            >
              View Contract Details
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center font-medium bg-black text-white hover:bg-neutral-800 border border-black text-sm px-4 py-2 h-9 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      <div className="mb-2">
        <Link href="/admin" className="text-xs font-semibold text-neutral-600 hover:text-black mb-2 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black">
              {draftId ? 'Resume / Edit Draft' : 'Create Signing Request'}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Upload a PDF or choose a reusable template to send in seconds.
            </p>
          </div>
          {draftId && (
            <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 border border-neutral-400 bg-neutral-100 text-black">
              Draft Mode
            </span>
          )}
        </div>
      </div>

      {/* Templates Selector Card */}
      {templates.length > 0 && (
        <div className="p-4 bg-neutral-50 border border-neutral-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-black">
              Use Reusable Template (Fast Send &lt; 5s)
            </span>
            <span className="text-[11px] text-neutral-500 font-mono">
              {templates.length} saved
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full p-2 bg-white border border-neutral-300 text-xs font-medium text-black focus:outline-none focus:border-black"
            >
              <option value="">-- Choose a template to pre-populate document &amp; fields --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.fields && t.fields.length > 0 ? `(${t.fields.length} fields)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {draftSavedMsg && (
        <div className="p-3 border border-black bg-neutral-900 text-white text-xs font-medium">
          {draftSavedMsg}
        </div>
      )}

      {templateSavedMsg && (
        <div className="p-3 border border-black bg-neutral-900 text-white text-xs font-medium">
          {templateSavedMsg}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Document Upload */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">1. Contract Document</h3>
              {fileBase64 && (
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  disabled={isSavingTemplate}
                  className="text-xs font-semibold text-black underline hover:text-neutral-600 cursor-pointer"
                >
                  {isSavingTemplate ? 'Saving Template...' : 'Save Document as Reusable Template'}
                </button>
              )}
            </div>

            <div className="border border-dashed border-neutral-300 p-6 text-center hover:border-black transition-colors bg-neutral-50/50">
              <DocumentIcon className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              {file ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-black">{file.name}</p>
                  <p className="text-xs text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setFileBase64(null);
                      setSignaturePage('');
                      setSignatureX('');
                      setSignatureY('');
                      setFields([]);
                    }}
                    className="text-xs text-black underline font-medium cursor-pointer"
                  >
                    Replace Document
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <span className="text-sm font-medium text-black underline">Choose a PDF file</span>
                  <span className="text-xs text-neutral-500 block mt-1">PDF format only, up to 20MB</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Step 2: Contract Details */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">2. Contract Information</h3>
            <Input
              label="Contract Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Services Agreement 2026"
              helperText="Descriptive title visible to you and the signer."
            />
          </div>

          {/* Step 3: Signer Details & Two-Party Agreement Toggle */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">3. Signer Details &amp; Flow</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Client Full Legal Name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
              <Input
                label="Client Email Address"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
              />
            </div>

            {/* Two-Party Agreement Toggle */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requiresCounterSign}
                  onChange={(e) => setRequiresCounterSign(e.target.checked)}
                  className="mt-0.5 rounded-none border-neutral-400 text-black focus:ring-black h-4 w-4"
                />
                <div>
                  <span className="text-xs font-bold text-black uppercase tracking-wider block">
                    Requires sender counter-signature (2-party agreement)
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    When client signs, agreement pauses at &ldquo;Needs Counter-Signature&rdquo; until you counter-sign to seal it.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Step 4: Signature & Multi-Field Placement */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                  4. Signature &amp; Document Fields
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Pre-assign signature, initials, date, or text inputs onto document pages.
                </p>
              </div>

              {(file || fileBase64) && (
                <Button
                  type="button"
                  variant={fields.length > 0 || signaturePage ? 'outline' : 'primary'}
                  size="sm"
                  onClick={() => setIsPrepModalOpen(true)}
                  className="shrink-0 text-xs"
                >
                  {fields.length > 0
                    ? `Edit Fields (${fields.length} set)`
                    : signaturePage
                    ? 'Change Location'
                    : 'Open Visual Field Preparation Tool'}
                </Button>
              )}
            </div>

            {!file && !fileBase64 ? (
              <div className="p-4 border border-dashed border-neutral-300 bg-neutral-50/50 text-xs text-neutral-500 text-center">
                Upload a contract PDF in Step 1 to visually set signature and fields.
              </div>
            ) : fields.length > 0 ? (
              <div className="p-4 bg-white border border-neutral-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-black rounded-full" />
                    <span className="text-xs font-bold text-black uppercase tracking-wider">
                      {fields.length} Placed Fields Configured
                    </span>
                  </div>
                  <span className="text-xs font-mono bg-neutral-100 border border-neutral-300 px-2 py-0.5">
                    {fields.map((f) => f.type).join(', ')}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPrepModalOpen(true)}
                    className="text-xs"
                  >
                    Adjust Fields on Document
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setFields([]);
                      setSignaturePage('');
                      setSignatureX('');
                      setSignatureY('');
                    }}
                    className="text-xs text-neutral-600 hover:text-black underline font-medium cursor-pointer"
                  >
                    Clear All Fields
                  </button>
                </div>
              </div>
            ) : signaturePage ? (
              <div className="p-4 bg-white border border-neutral-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-black rounded-full" />
                    <span className="text-xs font-bold text-black uppercase tracking-wider">
                      Pre-Assigned Location Set
                    </span>
                  </div>
                  <span className="text-xs font-mono bg-neutral-100 border border-neutral-300 px-2 py-0.5">
                    Page {signaturePage} • ({signatureX || 70} pt, {signatureY || 115} pt)
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPrepModalOpen(true)}
                    className="text-xs"
                  >
                    Adjust on Document
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignaturePage('');
                      setSignatureX('');
                      setSignatureY('');
                    }}
                    className="text-xs text-neutral-600 hover:text-black underline font-medium cursor-pointer"
                  >
                    Clear (Allow Client Free Placement)
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-800">
                    Free Placement (Default)
                  </span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Client chooses position
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  No fixed location designated. The client can freely position their signature anywhere on the document.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPrepModalOpen(true)}
                    className="text-xs"
                  >
                    Open Visual Field Preparation Tool
                  </Button>
                </div>
              </div>
            )}

            {/* Collapsible Manual Point Inputs */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowManualCoords(!showManualCoords)}
                className="text-[11px] text-neutral-400 hover:text-neutral-700 underline cursor-pointer"
              >
                {showManualCoords ? '− Hide manual point inputs' : '+ Advanced: Manual point coordinates override'}
              </button>

              {showManualCoords && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 mt-2 border-t border-neutral-100">
                  <Input
                    label="Target Page"
                    type="number"
                    min={1}
                    value={signaturePage}
                    onChange={(e) => setSignaturePage(e.target.value)}
                    helperText="Target PDF page number"
                    optional
                  />
                  <Input
                    label="Horizontal Position (X)"
                    type="number"
                    value={signatureX}
                    onChange={(e) => setSignatureX(e.target.value)}
                    helperText="Left distance in points (default: 70)"
                    optional
                  />
                  <Input
                    label="Vertical Position (Y)"
                    type="number"
                    value={signatureY}
                    onChange={(e) => setSignatureY(e.target.value)}
                    helperText="Bottom distance in points (default: 115)"
                    optional
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 5: Configuration */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">5. Request Configuration</h3>
            <Input
              label="Expiration Date"
              type="date"
              required
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              helperText="The client will not be able to sign after this date."
            />
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="instructions-message" className="text-sm font-semibold text-black">
                Instructions / Message to Signer
              </label>
              <textarea
                id="instructions-message"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white text-black text-sm border border-neutral-300 hover:border-black focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 border border-black bg-neutral-50 text-xs font-medium text-black" role="alert">
              <span className="font-bold underline mr-1">Error:</span>
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleSaveAsDraft}
              isLoading={isSavingDraft}
              loadingText="Saving Draft..."
            >
              Save as Draft
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              loadingText="Creating Signing Request..."
              disabled={(!file && !fileBase64) || !title || !clientName || !clientEmail}
            >
              CREATE SIGNING REQUEST
            </Button>
          </div>
        </form>
      </Card>

      {/* Admin Visual Signature Location Preparation Modal */}
      {isPrepModalOpen && fileBase64 && (
        <AdminFieldPreparationModal
          isOpen={isPrepModalOpen}
          onClose={() => setIsPrepModalOpen(false)}
          pdfBase64={fileBase64}
          initialPlacement={{
            page: signaturePage ? Number(signaturePage) : undefined,
            signatureX: signatureX ? Number(signatureX) : undefined,
            signatureY: signatureY ? Number(signatureY) : undefined,
          }}
          initialFields={fields}
          onSavePlacement={(p) => {
            setSignaturePage(String(p.page));
            setSignatureX(String(p.signatureX));
            setSignatureY(String(p.signatureY));
          }}
          onSaveFields={(savedFields, p) => {
            setFields(savedFields);
            setSignaturePage(String(p.page));
            setSignatureX(String(p.signatureX));
            setSignatureY(String(p.signatureY));
          }}
          onClearPlacement={() => {
            setFields([]);
            setSignaturePage('');
            setSignatureX('');
            setSignatureY('');
          }}
        />
      )}
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono">Loading contract creator...</div>}>
      <NewContractForm />
    </Suspense>
  );
}
