import { NextResponse } from 'next/server';
import { getContractById } from '@/lib/firebase/service';
import { getContractFileBuffer } from '@/lib/firebase/storage';
import { getAdminSession, isContractOwner } from '@/lib/auth/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'original'; // 'original' or 'signed'
  const token = searchParams.get('token'); // allow client download with valid token hash verification

  const contract = await getContractById(id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  // Authorization check: either authorized contract owner session or client token query matches
  const session = await getAdminSession();
  const isOwnerSession = session !== null && isContractOwner(session, contract);
  const isTokenClient = Boolean(token && contract.signingTokenHash === token);

  if (!isOwnerSession && !isTokenClient) {
    return NextResponse.json({ error: 'Unauthorized to download this file' }, { status: 401 });
  }

  const filePath = type === 'signed' ? contract.signedFilePath : contract.originalFilePath;
  if (!filePath) {
    return NextResponse.json({ error: 'Requested file is not available' }, { status: 404 });
  }

  let buffer = await getContractFileBuffer(filePath);
  if (!buffer) {
    const fallbackBase64 = type === 'signed' ? contract.signedPdfBase64 : contract.originalPdfBase64;
    if (fallbackBase64) {
      buffer = Buffer.from(fallbackBase64, 'base64');
    }
  }

  if (!buffer) {
    return NextResponse.json({ error: 'File could not be retrieved from storage' }, { status: 404 });
  }

  const filename = `${contract.title.replace(/[^a-zA-Z0-9_-]/g, '_')}-${type}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    },
  });
}
