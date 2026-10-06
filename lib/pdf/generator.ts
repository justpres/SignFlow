import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';

interface FinalizePdfParams {
  originalPdfBuffer: Buffer;
  clientName: string;
  signaturePngBase64: string;
  contractId: string;
  contractTitle: string;
  signedAtDate: string;
}

export async function generateSignedPdf({
  originalPdfBuffer,
  clientName,
  signaturePngBase64,
  contractId,
  contractTitle,
  signedAtDate,
}: FinalizePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Clean data URL prefix if present
  const base64Data = signaturePngBase64.replace(/^data:image\/png;base64,/, '');
  const signatureBytes = Buffer.from(base64Data, 'base64');
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  // Compute document SHA-256 for audit integrity
  const docHash = crypto.createHash('sha256').update(originalPdfBuffer).digest('hex');

  // Add formal Certificate of Completion & Signature Page
  const certPage = pdfDoc.addPage([595.28, 841.89]); // Standard A4 points
  const { width, height } = certPage.getSize();

  // Draw clean B&W header border
  certPage.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.5,
  });

  certPage.drawText('SIGNFLOW CERTIFICATE OF COMPLETION', {
    x: 55,
    y: height - 68,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  certPage.drawText('Document Finalization & Digital Signature Record', {
    x: 55,
    y: height - 85,
    size: 9,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Section: Document Summary
  let y = height - 130;
  certPage.drawText('CONTRACT DETAILS', {
    x: 40,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  y -= 15;
  certPage.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  y -= 25;
  const drawField = (label: string, value: string) => {
    certPage.drawText(label, { x: 40, y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    certPage.drawText(value, { x: 180, y, size: 9, font: helvetica, color: rgb(0, 0, 0) });
    y -= 18;
  };

  drawField('Contract Title:', contractTitle);
  drawField('Contract Reference ID:', contractId);
  drawField('Original Document SHA-256:', `${docHash.substring(0, 32)}...`);
  drawField('Audit Finalized Timestamp:', signedAtDate);

  // Section: Signer Details & Embedded Signature
  y -= 15;
  certPage.drawText('ELECTRONIC SIGNATURE RECORD', {
    x: 40,
    y,
    size: 10,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  y -= 15;
  certPage.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  y -= 25;
  drawField('Signer Legal Name:', clientName);
  drawField('Consent & Acceptance:', 'Verified (Explicitly agreed to contract terms)');

  // Signature box
  y -= 10;
  certPage.drawText('Captured Signature:', { x: 40, y: y + 25, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });

  const sigBoxWidth = 240;
  const sigBoxHeight = 80;
  const sigBoxX = 180;
  const sigBoxY = y - 60;

  certPage.drawRectangle({
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxWidth,
    height: sigBoxHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  const sigDims = signatureImage.scaleToFit(sigBoxWidth - 20, sigBoxHeight - 16);
  certPage.drawImage(signatureImage, {
    x: sigBoxX + (sigBoxWidth - sigDims.width) / 2,
    y: sigBoxY + (sigBoxHeight - sigDims.height) / 2,
    width: sigDims.width,
    height: sigDims.height,
  });

  // Footer & Tamper Evidence
  certPage.drawLine({
    start: { x: 40, y: 70 },
    end: { x: width - 40, y: 70 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });

  certPage.drawText('SignFlow Immutable Document Finalizer • Generated server-side • All rights reserved', {
    x: 40,
    y: 55,
    size: 8,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  const finalPdfBytes = await pdfDoc.save();
  return Buffer.from(finalPdfBytes);
}
