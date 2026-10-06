'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DocumentIcon, CopyIcon, CheckIcon } from '@/components/ui/Icons';

export default function NewContractPage() {
  const router = useRouter();

  // Form states
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => {
    // Default 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [message, setMessage] = useState('Please review and sign this agreement.');
  const [signaturePage, setSignaturePage] = useState('');
  const [signatureX, setSignatureX] = useState('');
  const [signatureY, setSignatureY] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Flow & submission states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      setFile(null);
      return;
    }

    if (selected.size > 20 * 1024 * 1024) {
      setError('File size must be under 20MB.');
      setFile(null);
      return;
    }

    setError(null);
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a contract PDF to upload.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('clientName', clientName);
      formData.append('clientEmail', clientEmail);
      formData.append('expiresAt', expiresAt);
      formData.append('message', message);
      formData.append('file', file);
      if (signaturePage) formData.append('signaturePage', signaturePage);
      if (signatureX) formData.append('signatureX', signatureX);
      if (signatureY) formData.append('signatureY', signatureY);

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
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-2 bg-black text-white">
              <CheckIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">Contract Created Successfully</h2>
              <p className="text-xs text-neutral-500">A private signing link is ready for your client.</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-neutral-50 border border-neutral-200 text-xs space-y-1.5">
              <div><span className="font-semibold">Contract Title:</span> {title}</div>
              <div><span className="font-semibold">Client Name:</span> {clientName}</div>
              <div><span className="font-semibold">Client Email:</span> {clientEmail}</div>
              <div><span className="font-semibold">Expiration:</span> {new Date(expiresAt).toLocaleDateString()}</div>
              <div><span className="font-semibold">Status:</span> SENT / AWAITING SIGNATURE</div>
            </div>

            <div className="space-y-2">
              <label htmlFor="signing-url-input" className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Private Signing Link
              </label>
              <div className="flex gap-2">
                <input
                  id="signing-url-input"
                  readOnly
                  value={signingUrl}
                  className="flex-1 font-mono text-xs px-3 py-2 bg-neutral-100 border border-neutral-300 select-all"
                />
                <Button variant="outline" size="sm" onClick={copyToClipboard} aria-label="Copy signing link">
                  {copied ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-3.5 h-3.5 mr-1" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                Send this link directly to {clientName}. The link does not require client registration.
              </p>
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
    <div className="max-w-2xl mx-auto py-4">
      <div className="mb-6">
        <Link href="/admin" className="text-xs font-semibold text-neutral-600 hover:text-black mb-2 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-black">Create Signing Request</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Upload a contract PDF and configure signing details for your client.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Document Upload */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-black mb-3">1. Contract Document</h3>
            <div className="border border-dashed border-neutral-300 p-6 text-center hover:border-black transition-colors bg-neutral-50/50">
              <DocumentIcon className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              {file ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-black">{file.name}</p>
                  <p className="text-xs text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
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
                    required
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

          {/* Step 3: Client Details */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">3. Signer Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Client Full Legal Name"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
              <Input
                label="Client Email Address"
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
              />
            </div>
          </div>

          {/* Step 4: Signature Placement on Letter */}
          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">4. Signature Placement on Letter</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                The client&apos;s electronic signature and printed legal name will be automatically stamped into the document&apos;s signature blank (_____).
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Target Page"
                type="number"
                min={1}
                value={signaturePage}
                onChange={(e) => setSignaturePage(e.target.value)}
                helperText="Page where signature line is located (leave empty for last page)."
                optional
              />
              <Input
                label="Horizontal Position (X)"
                type="number"
                value={signatureX}
                onChange={(e) => setSignatureX(e.target.value)}
                helperText="Left distance in points (default: 70)."
                optional
              />
              <Input
                label="Vertical Position (Y)"
                type="number"
                value={signatureY}
                onChange={(e) => setSignatureY(e.target.value)}
                helperText="Bottom distance in points (default: 115)."
                optional
              />
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

          <div className="flex justify-end pt-4 border-t border-neutral-100">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              loadingText="Creating Signing Request..."
              disabled={!file || !title || !clientName || !clientEmail}
            >
              CREATE SIGNING REQUEST
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
