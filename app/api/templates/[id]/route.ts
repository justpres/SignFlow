import { NextResponse } from 'next/server';
import { getTemplateById, deleteTemplate } from '@/lib/firebase/service';
import { getAdminSession } from '@/lib/auth/session';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const template = await getTemplateById(id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const template = await getTemplateById(id);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  await deleteTemplate(id);
  return NextResponse.json({ success: true });
}
