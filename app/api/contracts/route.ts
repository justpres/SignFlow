import { NextResponse } from 'next/server';
import { getAllContracts, saveContract, addAuditLog, getContractById } from '@/lib/firebase/service';
import { uploadContractFile } from '@/lib/firebase/storage';
import { generateSigningToken, hashSigningToken } from '@/lib/contracts/token';
import { Contract, PlacedField } from '@/lib/types';
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
    const isDraft = formData.get('isDraft') === 'true' || formData.get('status') === 'DRAFT';
    const draftId = formData.get('draftId') as string | null;

    const title = (formData.get('title') as string) || '';
    const clientName = (formData.get('clientName') as string) || '';
    const clientEmail = (formData.get('clientEmail') as string) || '';
    let expiresAt = (formData.get('expiresAt') as string) || '';
    const message = (formData.get('message') as string) || '';
    const file = formData.get('file') as File | null;
    const fileBase64 = formData.get('fileBase64') as string | null;
    const templateId = (formData.get('templateId') as string) || undefined;
    const requiresCounterSign = formData.get('requiresCounterSign') === 'true';

    // Parse multi-fields if provided
    let fields: PlacedField[] = [];
    const fieldsRaw = formData.get('fields') as string | null;
    if (fieldsRaw) {
      try {
        fields = JSON.parse(fieldsRaw);
      } catch (err) {
        console.warn('Failed to parse fields JSON:', err);
      }
    }

    if (!expiresAt) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      expiresAt = d.toISOString().split('T')[0];
    }

    let existingContract: Contract | null = null;
    if (draftId) {
      existingContract = await getContractById(draftId);
    }

    // Determine file buffer
    let fileBuffer: Buffer | null = null;
    if (file && file.size > 0) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Only PDF documents are supported' }, { status: 400 });
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else if (fileBase64) {
      const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } else if (existingContract?.originalPdfBase64) {
      fileBuffer = Buffer.from(existingContract.originalPdfBase64, 'base64');
    }

    // DRAFT FLOW
    if (isDraft) {
      const draftTitle = title || (file ? file.name.replace(/\.pdf$/i, '') : 'Untitled Draft');
      const contractId = existingContract ? existingContract.id : `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const originalStoragePath = `contracts/${contractId}/original.pdf`;

      if (fileBuffer && fileBuffer.length > 0) {
        await uploadContractFile(originalStoragePath, fileBuffer, 'application/pdf');
      }

      const signaturePage = formData.get('signaturePage') ? Number(formData.get('signaturePage')) : existingContract?.signaturePage;
      const signatureX = formData.get('signatureX') ? Number(formData.get('signatureX')) : existingContract?.signatureX;
      const signatureY = formData.get('signatureY') ? Number(formData.get('signatureY')) : existingContract?.signatureY;

      const draftContract: Contract = {
        id: contractId,
        title: draftTitle,
        clientName: clientName || '',
        clientEmail: clientEmail || '',
        status: 'DRAFT',
        originalFilePath: fileBuffer ? originalStoragePath : (existingContract?.originalFilePath || ''),
        signingTokenHash: '',
        createdAt: existingContract ? existingContract.createdAt : new Date().toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        contractVersion: (existingContract?.contractVersion || 0) + 1,
        message,
        originalPdfBase64: fileBuffer ? fileBuffer.toString('base64') : existingContract?.originalPdfBase64,
        signaturePage,
        signatureX,
        signatureY,
        fields: fields.length > 0 ? fields : existingContract?.fields,
        requiresCounterSign,
        templateId,
      };

      await saveContract(draftContract);
      await addAuditLog(contractId, 'DRAFT_SAVED', { title: draftTitle });

      return NextResponse.json({
        success: true,
        contract: draftContract,
        isDraft: true,
      });
    }

    // REGULAR SEND FLOW
    if (!title || !clientName || !clientEmail || !expiresAt) {
      return NextResponse.json({ error: 'Missing required contract fields (title, client name, email, expiration)' }, { status: 400 });
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: 'A PDF document is required to send a signing request' }, { status: 400 });
    }

    const contractId = existingContract ? existingContract.id : `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const originalStoragePath = `contracts/${contractId}/original.pdf`;

    await uploadContractFile(originalStoragePath, fileBuffer, 'application/pdf');

    // Generate secure signing token
    const rawSigningToken = generateSigningToken();
    const signingTokenHash = hashSigningToken(rawSigningToken);

    const signaturePage = formData.get('signaturePage') ? Number(formData.get('signaturePage')) : existingContract?.signaturePage;
    const signatureX = formData.get('signatureX') ? Number(formData.get('signatureX')) : existingContract?.signatureX;
    const signatureY = formData.get('signatureY') ? Number(formData.get('signatureY')) : existingContract?.signatureY;
    const nameX = formData.get('nameX') ? Number(formData.get('nameX')) : existingContract?.nameX;
    const nameY = formData.get('nameY') ? Number(formData.get('nameY')) : existingContract?.nameY;
    const dateX = formData.get('dateX') ? Number(formData.get('dateX')) : existingContract?.dateX;
    const dateY = formData.get('dateY') ? Number(formData.get('dateY')) : existingContract?.dateY;

    const contractToSend: Contract = {
      id: contractId,
      title,
      clientName,
      clientEmail,
      status: 'SENT',
      originalFilePath: originalStoragePath,
      signingTokenHash,
      createdAt: existingContract ? existingContract.createdAt : new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      contractVersion: (existingContract?.contractVersion || 0) + 1,
      message,
      originalPdfBase64: fileBuffer.toString('base64'),
      signaturePage,
      signatureX,
      signatureY,
      nameX,
      nameY,
      dateX,
      dateY,
      fields: fields.length > 0 ? fields : existingContract?.fields,
      requiresCounterSign: formData.has('requiresCounterSign') ? requiresCounterSign : (existingContract?.requiresCounterSign ?? false),
      templateId: templateId || existingContract?.templateId,
    };

    await saveContract(contractToSend);
    await addAuditLog(contractId, 'CONTRACT_CREATED', { title, clientEmail });
    await addAuditLog(contractId, 'CONTRACT_SENT', { clientEmail, expiresAt, requiresCounterSign });

    return NextResponse.json({
      success: true,
      contract: contractToSend,
      signingToken: rawSigningToken,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Contract creation failed:', error);
    return NextResponse.json({ error: `Failed to create contract: ${message}` }, { status: 500 });
  }
}
