import { NextResponse } from 'next/server';
import { getContractById, saveContract, addAuditLog, getAuditLogsForContract, deleteContract } from '@/lib/firebase/service';
import { getAdminSession } from '@/lib/auth/session';

function isContractOwner(session: { userId?: string; email: string }, contract: { userId?: string; ownerEmail?: string }): boolean {
  if (session.email === (process.env.ADMIN_EMAIL || 'admin@signflow.app')) return true;
  if (!contract.userId && !contract.ownerEmail) return true;
  if (contract.userId && session.userId && contract.userId === session.userId) return true;
  if (contract.ownerEmail && contract.ownerEmail.toLowerCase() === session.email.toLowerCase()) return true;
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
  const contract = await getContractById(id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (!isContractOwner(session, contract)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to view this contract' }, { status: 403 });
  }

  const auditLogs = await getAuditLogsForContract(id);
  return NextResponse.json({ contract, auditLogs });
}

export async function PATCH(
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
    return NextResponse.json({ error: 'Forbidden: You do not have permission to modify this contract' }, { status: 403 });
  }

  const body = await request.json();
  if (body.action === 'REVOKE') {
    if (contract.status === 'SIGNED') {
      return NextResponse.json({ error: 'Cannot revoke an already signed contract' }, { status: 400 });
    }

    contract.status = 'REVOKED';
    contract.revokedAt = new Date().toISOString();
    await saveContract(contract);
    await addAuditLog(id, 'CONTRACT_REVOKED', { revokedBy: session.email });

    return NextResponse.json({ success: true, contract });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
  const contract = await getContractById(id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (!isContractOwner(session, contract)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this contract' }, { status: 403 });
  }

  await deleteContract(id);
  return NextResponse.json({ success: true });
}
