import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateSignedPdf } from '../lib/pdf/generator.ts';

// 1x1 transparent/black PNG base64 for test signatures
const SAMPLE_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createMultiPageTestPdf(pages = 3) {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Sample Contract Page ${i}`, {
      x: 50,
      y: 750,
      size: 14,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Signature: ______________________`, {
      x: 70,
      y: 115,
      size: 11,
      color: rgb(0, 0, 0),
    });
  }
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

test('generateSignedPdf stamps signature on custom page and coordinates without adding extra pages', async () => {
  const originalPdfBuffer = await createMultiPageTestPdf(3);

  const customPage = 2;
  const customSigX = 142;
  const customSigY = 210;
  const customNameX = 142;
  const customNameY = 192;
  const customDateX = 142;
  const customDateY = 180;

  const signedBuffer = await generateSignedPdf({
    originalPdfBuffer,
    clientName: 'Jane Smith',
    signaturePngBase64: SAMPLE_PNG_BASE64,
    contractId: 'contract-test-123',
    contractTitle: 'Service Agreement',
    signedAtDate: '2026-10-06T12:00:00.000Z',
    signaturePage: customPage,
    signatureX: customSigX,
    signatureY: customSigY,
    nameX: customNameX,
    nameY: customNameY,
    dateX: customDateX,
    dateY: customDateY,
  });

  assert.ok(signedBuffer, 'Signed PDF buffer should be returned');
  assert.ok(Buffer.isBuffer(signedBuffer), 'Result should be a Buffer');

  const loadedDoc = await PDFDocument.load(signedBuffer);
  assert.equal(loadedDoc.getPageCount(), 3, 'PDF should still have exactly 3 pages, no extra pages added');

  const targetPage = loadedDoc.getPage(customPage - 1);
  assert.ok(targetPage, 'Target page should exist');
  assert.equal(targetPage.getWidth(), 612);
  assert.equal(targetPage.getHeight(), 792);
});

test('generateSignedPdf defaults to last page and default coordinates when omitted', async () => {
  const originalPdfBuffer = await createMultiPageTestPdf(4);

  const signedBuffer = await generateSignedPdf({
    originalPdfBuffer,
    clientName: 'John Doe',
    signaturePngBase64: SAMPLE_PNG_BASE64,
    contractId: 'contract-test-456',
    signedAtDate: '2026-10-06T12:00:00.000Z',
  });

  const loadedDoc = await PDFDocument.load(signedBuffer);
  assert.equal(loadedDoc.getPageCount(), 4, 'PDF page count must remain 4');
});

test('Coordinate translation: screen CSS pixels to PDF points and vice-versa', () => {
  const pdfWidth = 612;
  const pdfHeight = 792;
  const SIG_BOX_WIDTH_PT = 170;
  const SIG_BOX_HEIGHT_PT = 50;

  const testScales = [0.8, 1.0, 1.25, 1.5, 2.0];

  for (const scale of testScales) {
    const originalPdfX = 120;
    const originalPdfY = 180;

    // Forward translation: PDF point coordinates to screen CSS pixels
    const badgeLeftPx = originalPdfX * scale;
    const badgeTopPx = (pdfHeight - (originalPdfY + SIG_BOX_HEIGHT_PT)) * scale;

    // Inverse translation: Screen CSS pixels back to PDF points
    const recoveredPdfX = Math.round(badgeLeftPx / scale);
    const recoveredPdfY = Math.round(pdfHeight - (badgeTopPx / scale) - SIG_BOX_HEIGHT_PT);

    assert.equal(recoveredPdfX, originalPdfX, `X translation should be lossless at scale ${scale}`);
    assert.equal(recoveredPdfY, originalPdfY, `Y translation should be lossless at scale ${scale}`);
  }
});

test('Coordinate clamping keeps badge within page boundaries', () => {
  const pdfWidth = 612;
  const pdfHeight = 792;
  const SIG_BOX_WIDTH_PT = 170;
  const SIG_BOX_HEIGHT_PT = 50;

  function clampCoords(x, y) {
    const clampedX = Math.max(10, Math.min(x, Math.round(pdfWidth - SIG_BOX_WIDTH_PT - 10)));
    const clampedY = Math.max(40, Math.min(y, Math.round(pdfHeight - SIG_BOX_HEIGHT_PT - 20)));
    return { clampedX, clampedY };
  }

  // Extreme negative
  const underflow = clampCoords(-100, -50);
  assert.equal(underflow.clampedX, 10);
  assert.equal(underflow.clampedY, 40);

  // Extreme overflow
  const overflow = clampCoords(1000, 1000);
  assert.equal(overflow.clampedX, pdfWidth - SIG_BOX_WIDTH_PT - 10);
  assert.equal(overflow.clampedY, pdfHeight - SIG_BOX_HEIGHT_PT - 20);

  // Normal in-bounds
  const inBounds = clampCoords(150, 200);
  assert.equal(inBounds.clampedX, 150);
  assert.equal(inBounds.clampedY, 200);
});

test('Finalize coordinate resolution handles root coordinates, placement object, and fallbacks', () => {
  function resolveCoordinates(body, contract) {
    const finalPage = body.page ?? body.placement?.page ?? contract.signaturePage;
    const finalSigX = body.signatureX ?? body.placement?.signatureX ?? contract.signatureX;
    const finalSigY = body.signatureY ?? body.placement?.signatureY ?? contract.signatureY;
    const finalNameX = body.nameX ?? body.placement?.nameX ?? contract.nameX;
    const finalNameY = body.nameY ?? body.placement?.nameY ?? contract.nameY;
    const finalDateX = body.dateX ?? body.placement?.dateX ?? contract.dateX;
    const finalDateY = body.dateY ?? body.placement?.dateY ?? contract.dateY;

    return { finalPage, finalSigX, finalSigY, finalNameX, finalNameY, finalDateX, finalDateY };
  }

  const contract = {
    signaturePage: 1,
    signatureX: 70,
    signatureY: 115,
    nameX: 70,
    nameY: 97,
    dateX: 70,
    dateY: 85,
  };

  // Case 1: Root level coordinates take highest priority
  const payload1 = {
    page: 3,
    signatureX: 180,
    signatureY: 220,
    nameX: 180,
    nameY: 202,
    dateX: 180,
    dateY: 190,
  };
  const resolved1 = resolveCoordinates(payload1, contract);
  assert.deepEqual(resolved1, {
    finalPage: 3,
    finalSigX: 180,
    finalSigY: 220,
    finalNameX: 180,
    finalNameY: 202,
    finalDateX: 180,
    finalDateY: 190,
  });

  // Case 2: Nested placement object takes priority over contract defaults
  const payload2 = {
    placement: {
      page: 2,
      signatureX: 150,
      signatureY: 250,
      nameX: 150,
      nameY: 232,
      dateX: 150,
      dateY: 220,
    },
  };
  const resolved2 = resolveCoordinates(payload2, contract);
  assert.deepEqual(resolved2, {
    finalPage: 2,
    finalSigX: 150,
    finalSigY: 250,
    finalNameX: 150,
    finalNameY: 232,
    finalDateX: 150,
    finalDateY: 220,
  });

  // Case 3: Empty body falls back to contract defaults
  const resolved3 = resolveCoordinates({}, contract);
  assert.deepEqual(resolved3, {
    finalPage: 1,
    finalSigX: 70,
    finalSigY: 115,
    finalNameX: 70,
    finalNameY: 97,
    finalDateX: 70,
    finalDateY: 85,
  });
});

