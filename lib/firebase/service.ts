import type { Contract, AuditLog, AuditAction, ContractTemplate, User } from '../types/index.ts';
import { getAdminDb } from './admin.ts';
import fs from 'fs';
import path from 'path';

// Use /tmp directory if running on serverless (Vercel) where root filesystem is read-only
const LOCAL_DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.signflow_data')
  : path.join(process.cwd(), '.signflow_data');
const CONTRACTS_FILE = path.join(LOCAL_DATA_DIR, 'contracts.json');
const AUDITS_FILE = path.join(LOCAL_DATA_DIR, 'audits.json');
const TEMPLATES_FILE = path.join(LOCAL_DATA_DIR, 'templates.json');
const USERS_FILE = path.join(LOCAL_DATA_DIR, 'users.json');
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
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
}

function readLocalTemplates(): ContractTemplate[] {
  ensureLocalDirs();
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalTemplates(templates: ContractTemplate[]) {
  ensureLocalDirs();
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
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

function readLocalUsers(): User[] {
  ensureLocalDirs();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalUsers(users: User[]) {
  ensureLocalDirs();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function saveUser(user: User): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const cleanData = JSON.parse(JSON.stringify(user));
    await adminDb.collection('users').doc(user.id).set(cleanData);
  } else {
    const users = readLocalUsers();
    const idx = users.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user, updatedAt: new Date().toISOString() };
    } else {
      users.push(user);
    }
    writeLocalUsers(users);
  }
}

export async function getUserById(id: string): Promise<User | null> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const doc = await adminDb.collection('users').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as User;
  } else {
    const users = readLocalUsers();
    return users.find(u => u.id === id) || null;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as User;
  } else {
    const users = readLocalUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
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

export async function getAllContracts(userId?: string, ownerEmail?: string): Promise<Contract[]> {
  const adminDb = getAdminDb();
  if (adminDb) {
    if (userId) {
      const snap = await adminDb.collection('contracts').where('userId', '==', userId).get();
      const list = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as Contract);
      if (ownerEmail) {
        const emailSnap = await adminDb.collection('contracts').where('ownerEmail', '==', ownerEmail.toLowerCase()).get();
        const emailDocs = emailSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as Contract);
        for (const c of emailDocs) {
          if (!list.some(existing => existing.id === c.id)) {
            list.push(c);
          }
        }
      }
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      const snap = await adminDb.collection('contracts').get();
      const list = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as Contract);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } else {
    const contracts = readLocalContracts();
    const filtered = userId
      ? contracts.filter(c => c.userId === userId || (ownerEmail && c.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase()))
      : contracts;
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function deleteContract(id: string): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb) {
    await adminDb.collection('contracts').doc(id).delete();
    const snap = await adminDb.collection('audit_logs').where('contractId', '==', id).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  } else {
    const contracts = readLocalContracts();
    const filteredContracts = contracts.filter(c => c.id !== id);
    writeLocalContracts(filteredContracts);

    const audits = readLocalAudits();
    const filteredAudits = audits.filter(a => a.contractId !== id);
    writeLocalAudits(filteredAudits);

    const contractDir = path.join(LOCAL_DATA_DIR, 'storage', 'contracts', id);
    if (fs.existsSync(contractDir)) {
      try {
        fs.rmSync(contractDir, { recursive: true, force: true });
      } catch (err) {
        console.warn('Failed to clean up contract storage directory:', err);
      }
    }
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

export async function saveTemplate(template: ContractTemplate): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const cleanData = JSON.parse(JSON.stringify(template));
    await adminDb.collection('templates').doc(template.id).set(cleanData);
  } else {
    const templates = readLocalTemplates();
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      templates[idx] = template;
    } else {
      templates.push(template);
    }
    writeLocalTemplates(templates);
  }
}

export async function getTemplateById(id: string): Promise<ContractTemplate | null> {
  const adminDb = getAdminDb();
  if (adminDb) {
    const doc = await adminDb.collection('templates').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as ContractTemplate;
  } else {
    const templates = readLocalTemplates();
    return templates.find(t => t.id === id) || null;
  }
}

export async function getAllTemplates(userId?: string, ownerEmail?: string): Promise<ContractTemplate[]> {
  const adminDb = getAdminDb();
  if (adminDb) {
    if (userId) {
      const snap = await adminDb.collection('templates').where('userId', '==', userId).get();
      const list = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as ContractTemplate);
      if (ownerEmail) {
        const emailSnap = await adminDb.collection('templates').where('ownerEmail', '==', ownerEmail.toLowerCase()).get();
        const emailDocs = emailSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as ContractTemplate);
        for (const t of emailDocs) {
          if (!list.some(existing => existing.id === t.id)) {
            list.push(t);
          }
        }
      }
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      const snap = await adminDb.collection('templates').get();
      const list = snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as ContractTemplate);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } else {
    const templates = readLocalTemplates();
    const filtered = userId
      ? templates.filter(t => t.userId === userId || (ownerEmail && t.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase()))
      : templates;
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb) {
    await adminDb.collection('templates').doc(id).delete();
  } else {
    const templates = readLocalTemplates();
    const filtered = templates.filter(t => t.id !== id);
    writeLocalTemplates(filtered);
  }
}

