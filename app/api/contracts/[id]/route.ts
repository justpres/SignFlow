import { NextResponse } from 'next/server';
import { getContractById, saveContract, addAuditLog, getAuditLogsForContract } from '@/lib/firebase/service';
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
  const contract = await getContractById(id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
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
