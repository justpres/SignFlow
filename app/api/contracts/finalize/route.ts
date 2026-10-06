import { NextResponse } from 'next/server';
import { getContractByTokenHash, saveContract, addAuditLog } from '@/lib/firebase/service';
import { hashSigningToken } from '@/lib/contracts/token';
import { getContractFileBuffer, uploadContractFile } from '@/lib/firebase/storage';
import { generateSignedPdf } from '@/lib/pdf/generator';
import { sendContractSignedEmail } from '@/lib/notifications/email';
import { sendContractSignedTelegram } from '@/lib/notifications/telegram';

export async function POST(request: Request) {
  try {
    const { token, clientName, signatureDataUrl, signatureMethod } = await request.json();

    if (!token || !clientName || !signatureDataUrl) {
      return NextResponse.json({ error: 'Missing required signature submission fields' }, { status: 400 });
    }

    const tokenHash = hashSigningToken(token);
    const contract = await getContractByTokenHash(tokenHash);

    if (!contract) {
      return NextResponse.json({ error: 'Signing request not found' }, { status: 404 });
    }

    // Security validation checks:
    if (contract.status === 'REVOKED') {
      return NextResponse.json({ error: 'This signing request has been revoked by the sender.' }, { status: 403 });
    }

    if (contract.status === 'EXPIRED' || new Date(contract.expiresAt).getTime() < Date.now()) {
      if (contract.status !== 'EXPIRED') {
        contract.status = 'EXPIRED';
        await saveContract(contract);
        await addAuditLog(contract.id, 'CONTRACT_EXPIRED');
      }
      return NextResponse.json({ error: 'This signing request has expired.' }, { status: 410 });
    }

    // Atomic/Double submission prevention
    if (contract.status === 'SIGNED') {
      return NextResponse.json({
        error: 'Contract has already been signed.',
        signedAt: contract.signedAt,
        alreadySigned: true,
      }, { status: 409 });
    }

    // Retrieve original PDF bytes
    const originalPdfBuffer = await getContractFileBuffer(contract.originalFilePath);
    if (!originalPdfBuffer) {
      return NextResponse.json({ error: 'Original contract document could not be loaded.' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();

    // Generate signed PDF with pdf-lib
    const signedPdfBuffer = await generateSignedPdf({
      originalPdfBuffer,
      clientName,
      signaturePngBase64: signatureDataUrl,
      contractId: contract.id,
      contractTitle: contract.title,
      signedAtDate: nowIso,
    });

    // Store signed PDF as separate immutable artifact
    const signedStoragePath = `contracts/${contract.id}/signed.pdf`;
    await uploadContractFile(signedStoragePath, signedPdfBuffer, 'application/pdf');

    // Update contract state
    contract.status = 'SIGNED';
    contract.clientName = clientName;
    contract.signedAt = nowIso;
    contract.finalizedAt = nowIso;
    contract.signedFilePath = signedStoragePath;
    contract.signatureMethod = signatureMethod || 'DRAW';
    contract.confirmationAccepted = true;

    await saveContract(contract);

    // Audit logs
    await addAuditLog(contract.id, 'SIGNATURE_COMPLETED', { clientName, signatureMethod });
    await addAuditLog(contract.id, 'CONTRACT_SIGNED', { clientName, signedAt: nowIso });
    await addAuditLog(contract.id, 'SIGNED_PDF_GENERATED', { filePath: signedStoragePath });

    // Send Admin Notifications (Email & Telegram).
    // Note: Notification errors must not prevent contract finalization
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const adminDashboardContractUrl = `${baseUrl}/admin/contracts/${contract.id}`;

    // Dispatched asynchronously with graceful error handling
    try {
      await sendContractSignedEmail({
        to: process.env.ADMIN_EMAIL || 'admin@signflow.app',
        contractTitle: contract.title,
        clientName,
        signedAt: nowIso,
        contractId: contract.id,
        dashboardUrl: adminDashboardContractUrl,
      });
    } catch (err) {
      console.error('Email dispatch error (non-fatal):', err);
    }

    try {
      await sendContractSignedTelegram({
        contractTitle: contract.title,
        clientName,
        signedAt: nowIso,
        contractId: contract.id,
      });
    } catch (err) {
      console.error('Telegram dispatch error (non-fatal):', err);
    }

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      contractTitle: contract.title,
      clientName: contract.clientName,
      signedAt: contract.signedAt,
      downloadUrl: `/api/contracts/${contract.id}/download?type=signed&token=${tokenHash}`,
    });
  } catch (error) {
    console.error('Server finalization error:', error);
    return NextResponse.json({ error: 'Failed to finalize contract' }, { status: 500 });
  }
}
