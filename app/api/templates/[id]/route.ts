import { NextResponse } from 'next/server';
import { getTemplateById, deleteTemplate } from '@/lib/firebase/service';
import { getAdminSession } from '@/lib/auth/session';

function isTemplateOwner(session: { userId?: string; email: string }, template: { userId?: string; ownerEmail?: string }): boolean {
  if (session.email === (process.env.ADMIN_EMAIL || 'admin@signflow.app')) return true;
  if (!template.userId && !template.ownerEmail) return true;
  if (template.userId && session.userId && template.userId === session.userId) return true;
  if (template.ownerEmail && template.ownerEmail.toLowerCase() === session.email.toLowerCase()) return true;
  return false;
}

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
