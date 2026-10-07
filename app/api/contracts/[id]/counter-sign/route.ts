import { NextResponse } from 'next/server';
import { getContractById, saveContract, addAuditLog, getAuditLogsForContract } from '@/lib/firebase/service';
import { getContractFileBuffer, uploadContractFile } from '@/lib/firebase/storage';
import { generateSignedPdf } from '@/lib/pdf/generator';
import { getAdminSession } from '@/lib/auth/session';

function isContractOwner(session: { userId?: string; email: string }, contract: { userId?: string; ownerEmail?: string }): boolean {
  if (session.email === (process.env.ADMIN_EMAIL || 'admin@signflow.app')) return true;
  if (!contract.userId && !contract.ownerEmail) return true;
  if (contract.userId && session.userId && contract.userId === session.userId) return true;
  if (contract.ownerEmail && contract.ownerEmail.toLowerCase() === session.email.toLowerCase()) return true;
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const contract = await getContractById(id);

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (!isContractOwner(session, contract)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to counter-sign this contract' }, { status: 403 });
  }

  if (contract.status !== 'WAITING_COUNTER_SIGN') {
    return NextResponse.json(
      { error: `Contract is not awaiting counter-signature (current status: ${contract.status})` },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { counterSignatureDataUrl, counterSignerName } = body;

    if (!counterSignatureDataUrl) {
      return NextResponse.json({ error: 'Counter-signature image is required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const adminSignerName = counterSignerName || session.name || session.email || 'SignFlow Administrator';

    // Retrieve original contract PDF
    let originalPdfBuffer = await getContractFileBuffer(contract.originalFilePath);
    if (!originalPdfBuffer && contract.originalPdfBase64) {
      originalPdfBuffer = Buffer.from(contract.originalPdfBase64, 'base64');
    }
    if (!originalPdfBuffer) {
      return NextResponse.json({ error: 'Original contract PDF could not be loaded.' }, { status: 500 });
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                      request.headers.get('x-real-ip') ||
                      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Admin Dashboard';

    // Fetch chronological audit trail
    const existingLogs = await getAuditLogsForContract(contract.id);
    const auditEvents = existingLogs.map((log) => ({
      action: log.action,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.metadata ? JSON.stringify(log.metadata) : undefined,
    }));

    auditEvents.push({
      action: 'COUNTER_SIGNATURE_COMPLETED',
      timestamp: nowIso,
      ipAddress,
      userAgent,
      details: `Counter-signed and sealed by ${adminSignerName}`,
    });

    const clientSigBase64 = contract.signatureImagePath ||
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // Finalize two-party agreement with client signature and counter-signature
    const finalizedPdfBuffer = await generateSignedPdf({
      originalPdfBuffer,
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      signaturePngBase64: clientSigBase64,
      contractId: contract.id,
      contractTitle: contract.title,
      signedAtDate: contract.signedAt || nowIso,
      ipAddress,
      userAgent,
      signatureMethod: contract.signatureMethod || 'DRAW',
      auditEvents,
      signaturePage: contract.signaturePage,
      signatureX: contract.signatureX,
      signatureY: contract.signatureY,
      attachCertificate: false,
      fields: contract.fields,
      initialsPngBase64: contract.initialsImagePath,
      counterSignaturePngBase64: counterSignatureDataUrl,
      counterSignerName: adminSignerName,
      counterSignedAtDate: nowIso,
      counterSignPlacement: contract.counterSignPlacement,
    });

    const signedStoragePath = `contracts/${contract.id}/signed.pdf`;
    await uploadContractFile(signedStoragePath, finalizedPdfBuffer, 'application/pdf');

    contract.status = 'SIGNED';
    contract.counterSignedAt = nowIso;
    contract.counterSignerName = adminSignerName;
    contract.counterSignatureDataUrl = counterSignatureDataUrl;
    contract.finalizedAt = nowIso;
    contract.signedFilePath = signedStoragePath;
    contract.signedPdfBase64 = finalizedPdfBuffer.toString('base64');

    await saveContract(contract);

    await addAuditLog(contract.id, 'COUNTER_SIGNATURE_COMPLETED', {
      signerName: adminSignerName,
      timestamp: nowIso,
    }, ipAddress, userAgent);
    await addAuditLog(contract.id, 'CONTRACT_SIGNED', {
      details: 'Two-party agreement fully executed and sealed',
      finalizedAt: nowIso,
    }, ipAddress, userAgent);
    await addAuditLog(contract.id, 'SIGNED_PDF_GENERATED', {
      filePath: signedStoragePath,
    }, ipAddress, userAgent);

    return NextResponse.json({
      success: true,
      contract,
      downloadUrl: `/api/contracts/${contract.id}/download?type=signed`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Counter-signing failed:', error);
    return NextResponse.json({ error: `Counter-signing failed: ${message}` }, { status: 500 });
  }
}
