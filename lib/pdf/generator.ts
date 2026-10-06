import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
}

/**
 * Places the electronic signature and client legal name directly ONTO the existing contract page
 * exactly above the signature line (_____), without creating extra pages.
 */
export async function generateSignedPdf({
  originalPdfBuffer,
  clientName,
  signaturePngBase64,
  contractId,
  signedAtDate,
  signaturePage,
  signatureX,
  signatureY,
  nameX,
  nameY,
}: FinalizePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
  // X: Defaults to left margin (70) or admin-specified placement
  // Y: Defaults to signature line area (115) or admin-specified placement
  const posX = signatureX !== undefined ? signatureX : 70;
  const posY = signatureY !== undefined ? signatureY : 115;

  // Scale signature cleanly to fit the signature blank
  const sigBoxWidth = 170;
  const sigBoxHeight = 50;
  const sigDims = signatureImage.scaleToFit(sigBoxWidth, sigBoxHeight);

  // 1. Stamp the electronic signature directly on the signature line
  page.drawImage(signatureImage, {
    x: posX + (sigBoxWidth - sigDims.width) / 2,
    y: posY,
    width: sigDims.width,
    height: sigDims.height,
  });

  // 2. Auto-input the client's printed full legal name right below the signature line
  const printNameX = nameX !== undefined ? nameX : posX;
  const printNameY = nameY !== undefined ? nameY : Math.max(posY - 18, 40);

  page.drawText(clientName, {
    x: printNameX,
    y: printNameY,
    size: 11,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  // 3. Add digital audit stamp and reference code right beneath the signer's name
  page.drawText(`Digitally signed: ${new Date(signedAtDate).toLocaleDateString()} | ID: ${contractId}`, {
    x: printNameX,
    y: Math.max(printNameY - 12, 25),
    size: 8,
    font: helvetica,
    color: rgb(0.25, 0.25, 0.25),
  });

  const finalPdfBytes = await pdfDoc.save();
  return Buffer.from(finalPdfBytes);
}
