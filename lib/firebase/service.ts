import { Contract, AuditLog, AuditAction } from '@/lib/types';
import { getAdminDb } from './admin';
import fs from 'fs';
import path from 'path';

// Local disk persistence fallback for robust out-of-the-box local testing/verification without live GCP keys
const LOCAL_DATA_DIR = path.join(process.cwd(), '.signflow_data');
const CONTRACTS_FILE = path.join(LOCAL_DATA_DIR, 'contracts.json');
const AUDITS_FILE = path.join(LOCAL_DATA_DIR, 'audits.json');
export const LOCAL_STORAGE_DIR = path.join(LOCAL_DATA_DIR, 'storage');

function ensureLocalDirs() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONTRACTS_FILE)) {
    fs.writeFileSync(CONTRACTS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(AUDITS_FILE)) {
    fs.writeFileSync(AUDITS_FILE, JSON.stringify([]));
  }
}

function readLocalContracts(): Contract[] {
  ensureLocalDirs();
  try {
    const raw = fs.readFileSync(CONTRACTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalContracts(contracts: Contract[]) {
  ensureLocalDirs();
  fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2));
}

function readLocalAudits(): AuditLog[] {
  ensureLocalDirs();
  try {
    const raw = fs.readFileSync(AUDITS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalAudits(audits: AuditLog[]) {
  ensureLocalDirs();
  fs.writeFileSync(AUDITS_FILE, JSON.stringify(audits, null, 2));
}

export async function saveContract(contract: Contract): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const cleanData = JSON.parse(JSON.stringify(contract));
    await adminDb.collection('contracts').doc(contract.id).set(cleanData);
  } else {
    const contracts = readLocalContracts();
    const idx = contracts.findIndex(c => c.id === contract.id);
    if (idx >= 0) {
      contracts[idx] = contract;
    } else {
      contracts.push(contract);
    }
    writeLocalContracts(contracts);
  }
}

export async function getContractById(id: string): Promise<Contract | null> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const doc = await adminDb.collection('contracts').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as Contract;
  } else {
    const contracts = readLocalContracts();
    return contracts.find(c => c.id === id) || null;
  }
}

export async function getContractByTokenHash(tokenHash: string): Promise<Contract | null> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection('contracts').where('signingTokenHash', '==', tokenHash).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Contract;
  } else {
    const contracts = readLocalContracts();
    return contracts.find(c => c.signingTokenHash === tokenHash) || null;
  }
}

export async function getAllContracts(): Promise<Contract[]> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection('contracts').orderBy('createdAt', 'desc').get();
    return snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as Contract);
  } else {
    const contracts = readLocalContracts();
    return contracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function addAuditLog(
  contractId: string,
  action: AuditAction,
  metadata?: Record<string, string | number | boolean | null | undefined>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const audit: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    contractId,
    action,
    timestamp: new Date().toISOString(),
    ipAddress,
    userAgent,
    metadata,
  };

  const adminDb = getAdminDb();
  if (adminDb) {
    const cleanAudit = JSON.parse(JSON.stringify(audit));
    await adminDb.collection('audit_logs').doc(audit.id).set(cleanAudit);
  } else {
    const audits = readLocalAudits();
    audits.push(audit);
    writeLocalAudits(audits);
  }
}

export async function getAuditLogsForContract(contractId: string): Promise<AuditLog[]> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection('audit_logs').where('contractId', '==', contractId).get();
    const list = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as AuditLog);
    return list.sort((a: AuditLog, b: AuditLog) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } else {
    const audits = readLocalAudits();
    return audits
      .filter(a => a.contractId === contractId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
