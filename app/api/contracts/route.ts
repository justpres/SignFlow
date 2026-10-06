import { NextResponse } from 'next/server';
import { getAllContracts, saveContract, addAuditLog } from '@/lib/firebase/service';
import { uploadContractFile } from '@/lib/firebase/storage';
import { generateSigningToken, hashSigningToken } from '@/lib/contracts/token';
import { Contract } from '@/lib/types';
import { getAdminSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contracts = await getAllContracts();
  return NextResponse.json({ contracts });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const clientName = formData.get('clientName') as string;
    const clientEmail = formData.get('clientEmail') as string;
    const expiresAt = formData.get('expiresAt') as string;
    const message = (formData.get('message') as string) || '';
    const file = formData.get('file') as File | null;

    if (!title || !clientName || !clientEmail || !expiresAt || !file) {
      return NextResponse.json({ error: 'Missing required contract fields or PDF file' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF documents are supported' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (fileBuffer.length === 0) {
      return NextResponse.json({ error: 'PDF file is empty or corrupted' }, { status: 400 });
    }

    const contractId = `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const originalStoragePath = `contracts/${contractId}/original.pdf`;

    // Save PDF
    await uploadContractFile(originalStoragePath, fileBuffer, 'application/pdf');

    // Generate secure signing token
    const rawSigningToken = generateSigningToken();
    const signingTokenHash = hashSigningToken(rawSigningToken);

    const newContract: Contract = {
      id: contractId,
      title,
      clientName,
      clientEmail,
      status: 'SENT',
      originalFilePath: originalStoragePath,
      signingTokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      contractVersion: 1,
      message,
    };

    await saveContract(newContract);
    await addAuditLog(contractId, 'CONTRACT_CREATED', { title, clientEmail });
    await addAuditLog(contractId, 'CONTRACT_SENT', { clientEmail, expiresAt });

    return NextResponse.json({
      success: true,
      contract: newContract,
      signingToken: rawSigningToken, // returned once during creation to show/copy link
    });
  } catch (error) {
    console.error('Contract creation failed:', error);
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
  }
}
