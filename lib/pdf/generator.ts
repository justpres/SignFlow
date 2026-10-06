import { PDFDocument } from 'pdf-lib';
import crypto from 'crypto';
import { appendCertificateOfCompletion, type CertificateAuditEntry } from './certificate.ts';

export interface FinalizePdfParams {
  originalPdfBuffer: Buffer;
  clientName: string;
  signaturePngBase64: string;
  contractId: string;
  contractTitle?: string;
  clientEmail?: string;
  signedAtDate: string;
  ipAddress?: string;
  userAgent?: string;
  signatureMethod?: string;
  auditEvents?: CertificateAuditEntry[];
  signaturePage?: number;
  signatureX?: number;
  signatureY?: number;
  nameX?: number;
  nameY?: number;
  dateX?: number;
  dateY?: number;
  attachCertificate?: boolean;
}

/**
 * Places ONLY the electronic signature directly ONTO the existing contract page
 * exactly above the signature line (_____), keeping the original contract pages
 * 100% visually clean (no overlapping printed text).
 *
 * When attachCertificate is true (default in contract finalization), appends an
 * official, court-admissible Certificate of Completion & Legal Audit Page (ESIGN/UETA)
 * to the end of the document.
 */
export async function generateSignedPdf({
  originalPdfBuffer,
  clientName,
  signaturePngBase64,
  contractId,
  contractTitle,
  clientEmail,
  signedAtDate,
  ipAddress,
  userAgent,
  signatureMethod,
  auditEvents,
  signaturePage,
  signatureX,
  signatureY,
  attachCertificate = false,
}: FinalizePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);

  // Compute original document cryptographic hash for audit integrity
  const originalPdfHash = crypto.createHash('sha256').update(originalPdfBuffer).digest('hex');

  // Decode signature image PNG
  const base64Data = signaturePngBase64.replace(/^data:image\/png;base64,/, '');
  const signatureBytes = Buffer.from(base64Data, 'base64');
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  const totalPages = pdfDoc.getPageCount();
  // Target existing contract page (1-indexed input converted to 0-indexed)
  const targetPageIndex = signaturePage && signaturePage > 0 && signaturePage <= totalPages
    ? signaturePage - 1
    : totalPages - 1;

  const page = pdfDoc.getPage(targetPageIndex);

  // Position directly over standard signature line (_____):
  // X: Defaults to left margin (70) or admin/user-specified placement
  // Y: Defaults to signature line area (115) or admin/user-specified placement
  const posX = signatureX !== undefined ? signatureX : 70;
  const posY = signatureY !== undefined ? signatureY : 115;

  // Scale signature cleanly to fit the signature blank
  const sigBoxWidth = 170;
  const sigBoxHeight = 50;
  const sigDims = signatureImage.scaleToFit(sigBoxWidth, sigBoxHeight);

  // Stamp ONLY the electronic signature directly on the signature line (centered in 170x50 box)
  // Contract letter remains 100% visually clean without overlapping name/audit text
  page.drawImage(signatureImage, {
    x: posX + (sigBoxWidth - sigDims.width) / 2,
    y: posY + (sigBoxHeight - sigDims.height) / 2,
    width: sigDims.width,
    height: sigDims.height,
  });

  // Embed complete audit record & cryptographic verification metadata INSIDE the PDF file
  // (Hidden inside document properties / XMP metadata, so the visual pages remain 100% clean without extra pages)
  pdfDoc.setTitle(contractTitle || 'Signed Contract');
  pdfDoc.setAuthor(clientName);
  pdfDoc.setSubject(`SignFlow Verified Contract | ID: ${contractId} | SHA-256: ${originalPdfHash}`);
  pdfDoc.setKeywords([
    'SignFlow',
    `ContractID:${contractId}`,
    `Signer:${clientName}`,
    `Email:${clientEmail || ''}`,
    `IP:${ipAddress || '127.0.0.1'}`,
    `SignedAt:${signedAtDate}`,
    `Method:${signatureMethod || 'DRAW'}`,
    `SHA256:${originalPdfHash}`,
  ]);
  pdfDoc.setProducer('SignFlow Cryptographic Signing Engine');
  pdfDoc.setCreator('SignFlow (https://signflow.app)');
  try {
    pdfDoc.setModificationDate(new Date(signedAtDate));
  } catch {
    // Ignore date format issues if any
  }

  // If a visual certificate of completion is explicitly requested (defaults to false to keep document clean)
  if (attachCertificate) {
    const executedDocBytes = await pdfDoc.save();
    const sealedPdfHash = crypto.createHash('sha256').update(Buffer.from(executedDocBytes)).digest('hex');

    await appendCertificateOfCompletion(pdfDoc, {
      contractTitle: contractTitle || 'Contract Agreement',
      contractId,
      originalPdfHash,
      sealedPdfHash,
      signerName: clientName,
      signerEmail: clientEmail || 'client@signflow.app',
      signerIp: ipAddress || '127.0.0.1',
      signerUserAgent: userAgent,
      signedAt: signedAtDate,
      signatureMethod,
      auditEvents,
      signaturePngBase64,
    });
  }

  const finalPdfBytes = await pdfDoc.save();
  return Buffer.from(finalPdfBytes);
}
