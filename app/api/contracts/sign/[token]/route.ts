import { NextResponse } from 'next/server';
import { getContractByTokenHash, addAuditLog, saveContract } from '@/lib/firebase/service';
import { hashSigningToken } from '@/lib/contracts/token';
import { getContractFileBuffer } from '@/lib/firebase/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const tokenHash = hashSigningToken(token);
  const contract = await getContractByTokenHash(tokenHash);

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  // Check Expiration
  if (contract.status !== 'EXPIRED' && new Date(contract.expiresAt).getTime() < Date.now()) {
    contract.status = 'EXPIRED';
    await saveContract(contract);
    await addAuditLog(contract.id, 'CONTRACT_EXPIRED');
  }

  // If contract is active and opened for the first time
  if (contract.status === 'SENT') {
    contract.status = 'OPENED';
    contract.openedAt = new Date().toISOString();
    await saveContract(contract);
    const ipAddress = _request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                      _request.headers.get('x-real-ip') ||
                      '127.0.0.1';
    const userAgent = _request.headers.get('user-agent') || 'Browser Client';
    await addAuditLog(contract.id, 'CONTRACT_OPENED', undefined, ipAddress, userAgent);
  }

  // Load PDF base64 if available so client viewer can render safely
  let pdfBase64: string | null = null;
  const filePath = contract.status === 'SIGNED' ? (contract.signedFilePath || contract.originalFilePath) : contract.originalFilePath;
  const buffer = await getContractFileBuffer(filePath);
  if (buffer) {
    pdfBase64 = buffer.toString('base64');
  } else {
    pdfBase64 = contract.status === 'SIGNED'
      ? (contract.signedPdfBase64 || contract.originalPdfBase64 || null)
      : (contract.originalPdfBase64 || null);
  }

  return NextResponse.json({
    contract: {
      id: contract.id,
      title: contract.title,
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      ownerEmail: contract.ownerEmail,
      ownerName: contract.ownerName,
      status: contract.status,
      expiresAt: contract.expiresAt,
      signedAt: contract.signedAt,
      message: contract.message,
      signaturePage: contract.signaturePage,
      signatureX: contract.signatureX,
      signatureY: contract.signatureY,
      nameX: contract.nameX,
      nameY: contract.nameY,
      dateX: contract.dateX,
      dateY: contract.dateY,
      fields: contract.fields,
      requiresCounterSign: contract.requiresCounterSign,
    },
    pdfBase64,
  });
}
