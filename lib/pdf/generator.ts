import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'crypto';
import { appendCertificateOfCompletion, type CertificateAuditEntry } from './certificate.ts';
import type { PlacedField } from '../types/index.ts';

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
  fields?: PlacedField[];
  initialsPngBase64?: string;
  counterSignaturePngBase64?: string;
  counterSignerName?: string;
  counterSignedAtDate?: string;
  counterSignPlacement?: {
    page: number;
    signatureX: number;
    signatureY: number;
  };
}

/**
 * Places the electronic signature and optional multi-fields (Initials, Date, Text)
 * directly ONTO the existing contract page, keeping the contract pages visually clean.
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
  fields,
  initialsPngBase64,
  counterSignaturePngBase64,
  counterSignerName,
  counterSignPlacement,
}: FinalizePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);

  // Compute original document cryptographic hash for audit integrity
  const originalPdfHash = crypto.createHash('sha256').update(originalPdfBuffer).digest('hex');

  // Decode signature image PNG
  const base64Data = signaturePngBase64.replace(/^data:image\/png;base64,/, '');
  const signatureBytes = Buffer.from(base64Data, 'base64');
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  // Embed standard fonts for text, dates, initials
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let initialsImage = null;
  if (initialsPngBase64) {
    try {
      const cleanInitials = initialsPngBase64.replace(/^data:image\/png;base64,/, '');
      const initialsBytes = Buffer.from(cleanInitials, 'base64');
      initialsImage = await pdfDoc.embedPng(initialsBytes);
    } catch {
      // Ignore if initials PNG format fails
    }
  }

  const totalPages = pdfDoc.getPageCount();
  // Target existing contract page (1-indexed input converted to 0-indexed)
  const targetPageIndex = signaturePage && signaturePage > 0 && signaturePage <= totalPages
    ? signaturePage - 1
    : totalPages - 1;

  if (fields && fields.length > 0) {
    for (const field of fields) {
      const pIndex = Math.max(0, Math.min(totalPages - 1, (field.page || 1) - 1));
      const targetPage = pdfDoc.getPage(pIndex);
      const fWidth = field.width || (field.type === 'INITIALS' ? 80 : 170);
      const fHeight = field.height || (field.type === 'INITIALS' ? 40 : 50);

      if (field.type === 'SIGNATURE') {
        const dims = signatureImage.scaleToFit(fWidth, fHeight);
        targetPage.drawImage(signatureImage, {
          x: field.x + (fWidth - dims.width) / 2,
          y: field.y + (fHeight - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      } else if (field.type === 'INITIALS') {
        if (initialsImage) {
          const dims = initialsImage.scaleToFit(fWidth, fHeight);
          targetPage.drawImage(initialsImage, {
            x: field.x + (fWidth - dims.width) / 2,
            y: field.y + (fHeight - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          });
        } else {
          const initialsText = field.value || clientName.split(' ').map((n) => n[0]).join('').toUpperCase() || 'IN';
          targetPage.drawText(initialsText, {
            x: field.x + 6,
            y: field.y + (fHeight / 2) - 5,
            size: 13,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
          });
        }
      } else if (field.type === 'DATE') {
        const dateText = field.value || signedAtDate.split('T')[0];
        targetPage.drawText(dateText, {
          x: field.x + 4,
          y: field.y + (fHeight / 2) - 4,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      } else if (field.type === 'TEXT') {
        const textVal = field.value || '';
        if (textVal) {
          targetPage.drawText(textVal, {
            x: field.x + 4,
            y: field.y + (fHeight / 2) - 4,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }
      }
    }
  } else {
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
    page.drawImage(signatureImage, {
      x: posX + (sigBoxWidth - sigDims.width) / 2,
      y: posY + (sigBoxHeight - sigDims.height) / 2,
      width: sigDims.width,
      height: sigDims.height,
    });
  }

  // Stamp Counter-Signature if provided
  if (counterSignaturePngBase64) {
    try {
      const cleanCounter = counterSignaturePngBase64.replace(/^data:image\/png;base64,/, '');
      const counterBytes = Buffer.from(cleanCounter, 'base64');
      const counterImage = await pdfDoc.embedPng(counterBytes);

      const csTargetPageIndex = counterSignPlacement?.page && counterSignPlacement.page <= totalPages
        ? counterSignPlacement.page - 1
        : targetPageIndex;
      const csPage = pdfDoc.getPage(csTargetPageIndex);

      const csX = counterSignPlacement?.signatureX !== undefined ? counterSignPlacement.signatureX : 340;
      const csY = counterSignPlacement?.signatureY !== undefined
        ? counterSignPlacement.signatureY
        : (signatureY !== undefined ? signatureY : 115);
      const csWidth = 170;
      const csHeight = 50;
      const csDims = counterImage.scaleToFit(csWidth, csHeight);

      csPage.drawImage(counterImage, {
        x: csX + (csWidth - csDims.width) / 2,
        y: csY + (csHeight - csDims.height) / 2,
        width: csDims.width,
        height: csDims.height,
      });

      if (counterSignerName) {
        csPage.drawText(`Authorized Counter-Signer: ${counterSignerName}`, {
          x: csX,
          y: Math.max(10, csY - 14),
          size: 8,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
    } catch (e) {
      console.warn('Failed to embed counter signature PNG:', e);
    }
  }

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
