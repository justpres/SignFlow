import { PDFDocument } from 'pdf-lib';

interface FinalizePdfParams {
  originalPdfBuffer: Buffer;
  clientName: string;
  signaturePngBase64: string;
  contractId: string;
  contractTitle?: string;
  signedAtDate: string;
  signaturePage?: number;
  signatureX?: number;
  signatureY?: number;
  nameX?: number;
  nameY?: number;
  dateX?: number;
  dateY?: number;
}

/**
 * Places ONLY the electronic signature directly ONTO the existing contract page
 * exactly above the signature line (_____), without adding extra text (name, dates, audit tags)
 * or creating extra pages.
 */
export async function generateSignedPdf({
  originalPdfBuffer,
  signaturePngBase64,
  signaturePage,
  signatureX,
  signatureY,
}: FinalizePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);

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
  page.drawImage(signatureImage, {
    x: posX + (sigBoxWidth - sigDims.width) / 2,
    y: posY + (sigBoxHeight - sigDims.height) / 2,
    width: sigDims.width,
    height: sigDims.height,
  });

  const finalPdfBytes = await pdfDoc.save();
  return Buffer.from(finalPdfBytes);
}
