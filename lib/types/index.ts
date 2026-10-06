export type ContractStatus = 'DRAFT' | 'SENT' | 'OPENED' | 'SIGNED' | 'EXPIRED' | 'REVOKED';

export type SignatureMethod = 'DRAW' | 'TYPE';

export interface Contract {
  id: string;
  title: string;
  originalFilePath: string;
  signedFilePath?: string;
  clientName: string;
  clientEmail: string;
  status: ContractStatus;
  signingTokenHash: string;
  createdAt: string;
  openedAt?: string;
  signedAt?: string;
  expiresAt: string;
  revokedAt?: string;
  signatureMethod?: SignatureMethod;
  signatureImagePath?: string;
  contractVersion: number;
  confirmationAccepted?: boolean;
  finalizedAt?: string;
  message?: string;
  originalPdfBase64?: string;
  signedPdfBase64?: string;
  signaturePage?: number;
  signatureX?: number;
  signatureY?: number;
  nameX?: number;
  nameY?: number;
  dateX?: number;
  dateY?: number;
}

export interface SignaturePlacement {
  page: number;
  signatureX: number;
  signatureY: number;
  nameX: number;
  nameY: number;
  dateX: number;
  dateY: number;
}

export type AuditAction = 
  | 'CONTRACT_CREATED'
  | 'CONTRACT_SENT'
  | 'CONTRACT_OPENED'
  | 'SIGNATURE_STARTED'
  | 'SIGNATURE_COMPLETED'
  | 'CONTRACT_SIGNED'
  | 'SIGNED_PDF_GENERATED'
  | 'CONTRACT_DOWNLOADED'
  | 'CONTRACT_REVOKED'
  | 'CONTRACT_EXPIRED';

export interface AuditLog {
  id: string;
  contractId: string;
  action: AuditAction;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}
