import { NextResponse } from 'next/server';
import { getAllTemplates, saveTemplate } from '@/lib/firebase/service';
import { getAdminSession } from '@/lib/auth/session';
import { ContractTemplate } from '@/lib/types';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = await getAllTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, pdfBase64, fileName, fields, signaturePage, signatureX, signatureY, requiresCounterSign } = body;

    if (!title || !pdfBase64) {
      return NextResponse.json({ error: 'Template title and PDF content are required' }, { status: 400 });
    }

    const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const template: ContractTemplate = {
      id: templateId,
      title,
      description: description || '',
      pdfBase64,
      fileName: fileName || `${title.replace(/\s+/g, '_')}.pdf`,
      fields: fields || [],
      signaturePage: signaturePage !== undefined ? Number(signaturePage) : undefined,
      signatureX: signatureX !== undefined ? Number(signatureX) : undefined,
      signatureY: signatureY !== undefined ? Number(signatureY) : undefined,
      requiresCounterSign: Boolean(requiresCounterSign),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTemplate(template);
    return NextResponse.json({ success: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to save template: ${message}` }, { status: 500 });
  }
}
