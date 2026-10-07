export type ContractStatus = 'DRAFT' | 'SENT' | 'OPENED' | 'SIGNED' | 'EXPIRED' | 'REVOKED' | 'WAITING_COUNTER_SIGN';

export type SignatureMethod = 'DRAW' | 'TYPE';

export type FieldType = 'SIGNATURE' | 'INITIALS' | 'DATE' | 'TEXT';

export interface PlacedField {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  value?: string;
  required?: boolean;
  signerRole?: 'CLIENT' | 'SENDER';
}

export interface ContractTemplate {
  id: string;
  title: string;
  description?: string;
  pdfBase64: string;
  fileName?: string;
  fields?: PlacedField[];
  signaturePage?: number;
  signatureX?: number;
  signatureY?: number;
  requiresCounterSign?: boolean;
  createdAt: string;
  updatedAt?: string;
}

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
  initialsImagePath?: string;
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
  fields?: PlacedField[];
  requiresCounterSign?: boolean;
  counterSignPlacement?: {
    page: number;
    signatureX: number;
    signatureY: number;
  };
  counterSignedAt?: string;
  counterSignerName?: string;
  counterSignatureDataUrl?: string;
  templateId?: string;
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
  | 'CONTRACT_EXPIRED'
  | 'DRAFT_SAVED'
  | 'WAITING_COUNTER_SIGN'
  | 'COUNTER_SIGNATURE_COMPLETED';

export interface AuditLog {
  id: string;
  contractId: string;
  action: AuditAction;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}
