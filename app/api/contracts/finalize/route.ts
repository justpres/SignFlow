import { NextResponse } from 'next/server';
import { getContractByTokenHash, saveContract, addAuditLog, getAuditLogsForContract } from '@/lib/firebase/service';
import { hashSigningToken } from '@/lib/contracts/token';
import { getContractFileBuffer, uploadContractFile } from '@/lib/firebase/storage';
import { generateSignedPdf } from '@/lib/pdf/generator';
import { sendContractSignedEmail } from '@/lib/notifications/email';
import { sendContractSignedTelegram } from '@/lib/notifications/telegram';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      token,
      clientName,
      signatureDataUrl,
      signatureMethod,
      page,
      signatureX,
      signatureY,
      nameX,
      nameY,
      dateX,
      dateY,
      placement,
    } = body;

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

    // Retrieve original PDF bytes (from storage or embedded base64)
    let originalPdfBuffer = await getContractFileBuffer(contract.originalFilePath);
    if (!originalPdfBuffer && contract.originalPdfBase64) {
      originalPdfBuffer = Buffer.from(contract.originalPdfBase64, 'base64');
    }
    if (!originalPdfBuffer) {
      return NextResponse.json({ error: 'Original contract document could not be loaded.' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();

    // Determine final placement coordinates (prefer client submitted placement, fallback to contract defaults)
    const finalPage = page ?? placement?.page ?? contract.signaturePage;
    const finalSigX = signatureX ?? placement?.signatureX ?? contract.signatureX;
    const finalSigY = signatureY ?? placement?.signatureY ?? contract.signatureY;
    const finalNameX = nameX ?? placement?.nameX ?? contract.nameX;
    const finalNameY = nameY ?? placement?.nameY ?? contract.nameY;
    const finalDateX = dateX ?? placement?.dateX ?? contract.dateX;
    const finalDateY = dateY ?? placement?.dateY ?? contract.dateY;

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                      request.headers.get('x-real-ip') ||
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Device';

    // Fetch existing chronological audit events for official Certificate of Completion
    const existingLogs = await getAuditLogsForContract(contract.id);
    const auditEvents = existingLogs.map((log) => ({
      action: log.action,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.metadata ? JSON.stringify(log.metadata) : undefined,
    }));

    auditEvents.push({
      action: 'CONTRACT_SIGNED',
      timestamp: nowIso,
      ipAddress,
      userAgent,
      details: `Signed by ${clientName} (${signatureMethod || 'DRAW'})`,
    });
    auditEvents.push({
      action: 'SIGNED_PDF_GENERATED',
      timestamp: nowIso,
      ipAddress,
      userAgent,
      details: 'Official Certificate of Completion & sealed record generated',
    });

    // Generate signed PDF with pdf-lib: clean signature stamp on contract line + appended Certificate of Completion
    const signedPdfBuffer = await generateSignedPdf({
      originalPdfBuffer,
      clientName,
      clientEmail: contract.clientEmail,
      signaturePngBase64: signatureDataUrl,
      contractId: contract.id,
      contractTitle: contract.title,
      signedAtDate: nowIso,
      ipAddress,
      userAgent,
      signatureMethod: signatureMethod || 'DRAW',
      auditEvents,
      signaturePage: finalPage,
      signatureX: finalSigX,
      signatureY: finalSigY,
      nameX: finalNameX,
      nameY: finalNameY,
      dateX: finalDateX,
      dateY: finalDateY,
      attachCertificate: true,
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
    contract.signedPdfBase64 = signedPdfBuffer.toString('base64');
    contract.signatureMethod = signatureMethod || 'DRAW';
    contract.confirmationAccepted = true;
    if (finalPage !== undefined) contract.signaturePage = finalPage;
    if (finalSigX !== undefined) contract.signatureX = finalSigX;
    if (finalSigY !== undefined) contract.signatureY = finalSigY;
    if (finalNameX !== undefined) contract.nameX = finalNameX;
    if (finalNameY !== undefined) contract.nameY = finalNameY;
    if (finalDateX !== undefined) contract.dateX = finalDateX;
    if (finalDateY !== undefined) contract.dateY = finalDateY;

    await saveContract(contract);

    // Audit logs with client IP address and device telemetry
    await addAuditLog(contract.id, 'SIGNATURE_COMPLETED', {
      clientName,
      signatureMethod,
      signaturePage: finalPage,
      signatureX: finalSigX,
      signatureY: finalSigY,
    }, ipAddress, userAgent);
    await addAuditLog(contract.id, 'CONTRACT_SIGNED', { clientName, signedAt: nowIso }, ipAddress, userAgent);
    await addAuditLog(contract.id, 'SIGNED_PDF_GENERATED', { filePath: signedStoragePath }, ipAddress, userAgent);

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
