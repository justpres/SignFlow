'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Contract, AuditLog } from '@/lib/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AuditTimeline } from '@/components/admin/AuditTimeline';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DownloadIcon, WarningIcon } from '@/components/ui/Icons';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { TypedSignature } from '@/components/signature/TypedSignature';

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Counter-sign states
  const [showCounterSignModal, setShowCounterSignModal] = useState(false);
  const [isCounterSigning, setIsCounterSigning] = useState(false);
  const [counterSignerName, setCounterSignerName] = useState('SignFlow Administrator');
  const [counterSigMethod, setCounterSigMethod] = useState<'DRAW' | 'TYPE'>('DRAW');
  const [drawnSig, setDrawnSig] = useState<string | null>(null);
  const [typedSig, setTypedSig] = useState<string | null>(null);
  const [counterSignError, setCounterSignError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContract(data.contract);
        setAuditLogs(data.auditLogs || []);
      }
    } catch (e) {
      console.error('Failed to load contract details:', e);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REVOKE' }),
      });
      if (res.ok) {
        setShowRevokeModal(false);
        fetchDetails();
      }
    } catch (e) {
      console.error('Revoke failed:', e);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setShowDeleteModal(false);
        router.push('/admin');
      }
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCounterSignConfirm = async () => {
    const activeSig = counterSigMethod === 'DRAW' ? drawnSig : typedSig;
    if (!activeSig) {
      setCounterSignError('Please provide your signature before sealing.');
      return;
    }

    setIsCounterSigning(true);
    setCounterSignError(null);

    try {
      const res = await fetch(`/api/contracts/${id}/counter-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterSignatureDataUrl: activeSig,
          counterSignerName: counterSignerName.trim() || 'SignFlow Administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCounterSignError(data.error || 'Failed to counter-sign document.');
        setIsCounterSigning(false);
        return;
      }

      setShowCounterSignModal(false);
      setIsCounterSigning(false);
      fetchDetails();
    } catch {
      setCounterSignError('Network error while counter-signing.');
      setIsCounterSigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 space-y-4 max-w-4xl mx-auto">
        <div className="w-48 h-6 bg-neutral-200 animate-pulse" />
        <div className="w-full h-64 bg-neutral-100 animate-pulse border border-neutral-200" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="py-12 text-center max-w-md mx-auto">
        <WarningIcon className="w-8 h-8 mx-auto text-black mb-2" />
        <h2 className="text-lg font-bold">Contract Not Found</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-4">The requested contract could not be retrieved.</p>
        <Link href="/admin" className="text-xs font-semibold underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isAwaitingCounterSign = contract.status === 'WAITING_COUNTER_SIGN';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/admin" className="text-xs font-semibold text-neutral-600 hover:text-black mb-2 inline-block">
          ← Back to Dashboard
        </Link>

        {/* Counter-Sign Action Callout Banner */}
        {isAwaitingCounterSign && (
          <div className="mb-6 p-4 bg-neutral-900 border-2 border-black text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                  Counter-Signature Required
                </span>
              </div>
              <p className="text-sm font-semibold text-white">
                Client {contract.clientName} has signed this agreement. Counter-sign to seal and finalize.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setShowCounterSignModal(true)}
              className="bg-white text-black hover:bg-neutral-200 shrink-0 font-bold text-xs"
            >
              Counter-Sign Agreement →
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-black break-words">{contract.title}</h1>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-xs font-mono text-neutral-400 mt-1 break-all">Reference: {contract.id}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {isAwaitingCounterSign && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCounterSignModal(true)}
                className="bg-black text-white hover:bg-neutral-800 font-bold"
              >
                Counter-Sign Now
              </Button>
            )}

            <a
              href={`/api/contracts/${contract.id}/download?type=original`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-neutral-300 hover:border-black font-medium text-black focus-visible:outline-black"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              Original PDF
            </a>

            {contract.status === 'SIGNED' && (
              <a
                href={`/api/contracts/${contract.id}/download?type=signed`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-black text-white hover:bg-neutral-800 font-medium focus-visible:outline-black"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Download Signed PDF
              </a>
            )}

            {contract.status === 'WAITING_COUNTER_SIGN' && contract.signedFilePath && (
              <a
                href={`/api/contracts/${contract.id}/download?type=signed`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-neutral-300 hover:border-black font-medium text-black focus-visible:outline-black"
                title="Review document with client signature before counter-signing"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Preview Client Signature PDF
              </a>
            )}

            {contract.status !== 'SIGNED' && contract.status !== 'REVOKED' && contract.status !== 'EXPIRED' && (
              <Button variant="outline" size="sm" onClick={() => setShowRevokeModal(true)}>
                Cancel Signing Request
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="text-neutral-600 border-neutral-300 hover:border-black hover:text-black"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Contract
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Contract Metadata */}
        <div className="lg:col-span-2 min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Signer &amp; Contract Summary</CardTitle>
            </CardHeader>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-neutral-500 font-medium">Signer Full Name</dt>
                <dd className="text-black font-bold text-sm mt-0.5">{contract.clientName || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 font-medium">Signer Email</dt>
                <dd className="text-black font-medium text-sm mt-0.5">{contract.clientEmail || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500 font-medium">Created Date</dt>
                <dd className="text-black font-mono mt-0.5">
                  {new Date(contract.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 font-medium">Expiration Date</dt>
                <dd className="text-black font-mono mt-0.5">
                  {contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString() : '—'}
                </dd>
              </div>

              {contract.signedAt && (
                <div>
                  <dt className="text-neutral-500 font-medium">Client Signed Timestamp</dt>
                  <dd className="text-black font-mono mt-0.5 font-bold">
                    {new Date(contract.signedAt).toLocaleString()}
                  </dd>
                </div>
              )}

              {contract.counterSignedAt && (
                <div>
                  <dt className="text-neutral-500 font-medium">Counter-Signed Timestamp</dt>
                  <dd className="text-black font-mono mt-0.5 font-bold">
                    {new Date(contract.counterSignedAt).toLocaleString()} ({contract.counterSignerName})
                  </dd>
                </div>
              )}

              {contract.signatureMethod && (
                <div>
                  <dt className="text-neutral-500 font-medium">Signature Method</dt>
                  <dd className="text-black font-medium mt-0.5">
                    {contract.signatureMethod === 'DRAW' ? 'Handwritten Canvas' : 'Typed Electronic Name'}
                  </dd>
                </div>
              )}

              {contract.requiresCounterSign && (
                <div>
                  <dt className="text-neutral-500 font-medium">Agreement Type</dt>
                  <dd className="text-black font-semibold mt-0.5">
                    Two-Party Agreement (Requires Sender Counter-Signature)
                  </dd>
                </div>
              )}

              {contract.fields && contract.fields.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-neutral-500 font-medium">Placed Fields ({contract.fields.length})</dt>
                  <dd className="text-black font-mono text-[11px] mt-1 space-x-2">
                    {contract.fields.map((f) => (
                      <span key={f.id} className="inline-block px-2 py-0.5 border border-neutral-200 bg-neutral-50">
                        {f.label || f.type} (P.{f.page})
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {contract.message && (
              <div className="mt-6 pt-4 border-t border-neutral-100 text-xs">
                <span className="text-neutral-500 font-medium block mb-1">Message included to signer:</span>
                <p className="text-neutral-800 italic bg-neutral-50 p-2.5 border border-neutral-200">
                  &ldquo;{contract.message}&rdquo;
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Evidence & Audit Log */}
        <div className="lg:col-span-1 min-w-0">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
            </CardHeader>
            <AuditTimeline logs={auditLogs} />
          </Card>
        </div>
      </div>

      {/* Counter-Sign Modal */}
      <Modal
        isOpen={showCounterSignModal}
        onClose={() => setShowCounterSignModal(false)}
        title="Counter-Sign Agreement"
        description="Provide your authorized sender signature to execute and legally seal this two-party agreement."
      >
        <div className="space-y-4">
          <Input
            label="Authorized Signer Legal Name"
            value={counterSignerName}
            onChange={(e) => setCounterSignerName(e.target.value)}
            placeholder="SignFlow Administrator"
          />

          <div className="space-y-2">
            <div className="flex border-b border-neutral-200">
              <button
                type="button"
                onClick={() => setCounterSigMethod('DRAW')}
                className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border-b-2 ${
                  counterSigMethod === 'DRAW' ? 'border-black text-black' : 'border-transparent text-neutral-500'
                }`}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setCounterSigMethod('TYPE')}
                className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border-b-2 ${
                  counterSigMethod === 'TYPE' ? 'border-black text-black' : 'border-transparent text-neutral-500'
                }`}
              >
                Type Signature
              </button>
            </div>

            {counterSigMethod === 'DRAW' ? (
              <SignaturePad onSignatureChange={setDrawnSig} />
            ) : (
              <TypedSignature
                name={counterSignerName}
                onSignatureGenerated={setTypedSig}
              />
            )}
          </div>

          {counterSignError && (
            <div className="p-2 border border-black bg-neutral-50 text-xs text-black font-medium">
              {counterSignError}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-3 border-t border-neutral-100">
            <Button variant="outline" onClick={() => setShowCounterSignModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCounterSignConfirm}
              isLoading={isCounterSigning}
              loadingText="Sealing Agreement..."
            >
              Counter-Sign &amp; Seal Agreement
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Request Confirmation Dialog */}
      <Modal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        title="Cancel Signing Request"
        description="Are you sure you want to cancel this contract request? The client's signing link will be immediately disabled."
      >
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={() => setShowRevokeModal(false)}>
            Keep Active
          </Button>
          <Button
            variant="primary"
            onClick={handleRevoke}
            isLoading={isRevoking}
            loadingText="Cancelling..."
          >
            Confirm Cancellation
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Contract"
        description="Are you sure you want to permanently delete this contract and all associated audit logs? This action cannot be undone."
      >
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-black hover:bg-neutral-800 text-white"
            onClick={handleDelete}
            isLoading={isDeleting}
            loadingText="Deleting..."
          >
            Permanently Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
