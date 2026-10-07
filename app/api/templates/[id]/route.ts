import { NextResponse } from 'next/server';
import { getTemplateById, deleteTemplate } from '@/lib/firebase/service';
import { getAdminSession, isTemplateOwner } from '@/lib/auth/session';

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

  if (!isTemplateOwner(session, template)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to access this template' }, { status: 403 });
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

  if (!isTemplateOwner(session, template)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this template' }, { status: 403 });
  }

  await deleteTemplate(id);
  return NextResponse.json({ success: true });
}
