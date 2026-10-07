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

test('Header tab clearance: clamping calculation reserves minimum top margin at all scales', () => {
  const pageHeight = 792;
  const SIG_BOX_HEIGHT_PT = 50;

  for (const scale of [0.6, 0.8, 1.0, 1.25, 1.5, 2.0]) {
    const minTopMarginPt = Math.ceil(32 / scale);
    const maxSigY = Math.round(pageHeight - SIG_BOX_HEIGHT_PT - minTopMarginPt);

    // Compute top distance of signature box in screen pixels at maximum Y
    const sigBoxTopPx = (pageHeight - (maxSigY + SIG_BOX_HEIGHT_PT)) * scale;

    // The -top-7 (28px) drag header tab must fit within the page container without clipping
    assert.ok(
      sigBoxTopPx >= 28,
      `At scale ${scale}, top pixel clearance (${sigBoxTopPx}px) must be >= 28px for the top drag tab`
    );
  }
});

test('Data URI prefix sanitizer correctly handles raw base64 and standard PDF data URIs', () => {
  const sanitize = (str) => str.trim().replace(/^data:[^;]+;base64,/, '');

  const raw = 'JVBERi0xLjUKJUZha2VQZGY=';
  const withPrefix = 'data:application/pdf;base64,JVBERi0xLjUKJUZha2VQZGY=';
  const withWhitespace = '  data:application/pdf;base64,JVBERi0xLjUKJUZha2VQZGY=  \n';

  assert.equal(sanitize(raw), raw);
  assert.equal(sanitize(withPrefix), raw);
  assert.equal(sanitize(withWhitespace), raw);
});

test('In-Situ Field PNG Data URI embedding: stamps both image signature and image initials fields', async () => {
  const originalPdfBuffer = await createMultiPageTestPdf(1);

  const fieldsWithImages = [
    {
      id: 'f-sig',
      type: 'SIGNATURE',
      page: 1,
      x: 70,
      y: 115,
      width: 170,
      height: 50,
      value: SAMPLE_PNG_BASE64,
    },
    {
      id: 'f-ini',
      type: 'INITIALS',
      page: 1,
      x: 260,
      y: 115,
      width: 80,
      height: 40,
      value: SAMPLE_PNG_BASE64,
    },
  ];

  const signedBuffer = await generateSignedPdf({
    originalPdfBuffer,
    clientName: 'Jane Smith',
    signaturePngBase64: SAMPLE_PNG_BASE64,
    contractId: 'contract-test-images',
    contractTitle: 'In-Situ Field Images',
    signedAtDate: '2026-10-07T12:00:00.000Z',
    fields: fieldsWithImages,
  });

  assert.ok(signedBuffer instanceof Buffer);
  const loaded = await PDFDocument.load(signedBuffer);
  assert.equal(loaded.getPageCount(), 1);
});

test('In-situ tethered tray positioning: desktop tethering vs mobile bottom sheet docking', () => {
  const pageDimensions = { width: 612, height: 792 };
  const scale = 1.0;

  function calculateTrayStyle(field, isMobile) {
    if (!field || isMobile) {
      return { touchAction: 'none' };
    }
    const leftPx = Math.max(
      12,
      Math.min(
        Math.round(field.x * scale) + Math.round((field.width * scale) / 2) - 210,
        Math.round(pageDimensions.width * scale) - 432
      )
    );
    const topPx = Math.round((pageDimensions.height - field.y - field.height) * scale);
    const heightPx = Math.round(field.height * scale);
    const preferredTop =
      topPx + heightPx + 420 > pageDimensions.height * scale
        ? Math.max(12, topPx - 410)
        : topPx + heightPx + 12;

    return {
      top: `${preferredTop}px`,
      left: `${leftPx}px`,
      touchAction: 'none',
    };
  }

  const sampleField = { id: 'f1', type: 'SIGNATURE', page: 1, x: 100, y: 150, width: 170, height: 50 };

  // Mobile mode must not set inline top and left coordinates
  const mobileStyle = calculateTrayStyle(sampleField, true);
  assert.strictEqual(mobileStyle.top, undefined, 'Mobile style must not contain inline top');
  assert.strictEqual(mobileStyle.left, undefined, 'Mobile style must not contain inline left');
  assert.strictEqual(mobileStyle.touchAction, 'none');

  // Desktop mode must calculate tethered coordinates
  const desktopStyle = calculateTrayStyle(sampleField, false);
  assert.ok(desktopStyle.top !== undefined, 'Desktop style must calculate inline top');
  assert.ok(desktopStyle.left !== undefined, 'Desktop style must calculate inline left');
  assert.strictEqual(typeof desktopStyle.top, 'string');
  assert.strictEqual(typeof desktopStyle.left, 'string');
});

test('In-situ required fields validation ensures all mandatory fields are completed', () => {
  function validateFieldsForReview(signerName, fields, hasAppliedSignature) {
    if (!signerName.trim()) {
      return { valid: false, error: 'Please enter your full legal name before proceeding.' };
    }
    if (!hasAppliedSignature) {
      return { valid: false, error: 'Please tap the designated signature anchor on the document to apply your signature.' };
    }
    const missingRequired = fields.filter(
      (f) => f.required !== false && f.type !== 'DATE' && !f.value
    );
    if (missingRequired.length > 0) {
      const missingLabels = missingRequired
        .map((f) => f.label || (f.type === 'SIGNATURE' ? 'Signature' : f.type === 'INITIALS' ? 'Initials' : f.type))
        .join(', ');
      return { valid: false, error: `Please complete all required fields (${missingLabels}) before proceeding.` };
    }
    return { valid: true };
  }

  const incompleteFields = [
    { id: '1', type: 'SIGNATURE', required: true, value: 'data:image/png;base64,...' },
    { id: '2', type: 'INITIALS', required: true, value: undefined },
    { id: '3', type: 'DATE', required: true, value: undefined },
  ];

  // Missing initials should be rejected
  const res1 = validateFieldsForReview('John Doe', incompleteFields, true);
  assert.strictEqual(res1.valid, false);
  assert.match(res1.error, /Initials/);

  // When initials are filled, validation passes (DATE is auto-populated upon signing)
  incompleteFields[1].value = 'JD';
  const res2 = validateFieldsForReview('John Doe', incompleteFields, true);
  assert.strictEqual(res2.valid, true);

  // Missing name is rejected
  const res3 = validateFieldsForReview('', incompleteFields, true);
  assert.strictEqual(res3.valid, false);
  assert.match(res3.error, /legal name/);
});
test('Fast mobile signer stroke stack: undo pops last stroke, clear removes all', () => {
  let strokes = [];

  // Add stroke 1
  strokes.push([
    { x: 100, y: 150 },
    { x: 105, y: 152 },
    { x: 110, y: 155 },
  ]);
  assert.equal(strokes.length, 1);

  // Add stroke 2
  strokes.push([
    { x: 110, y: 155 },
    { x: 120, y: 160 },
  ]);
  assert.equal(strokes.length, 2);

  // Word-style Undo: pop last stroke
  strokes = strokes.slice(0, -1);
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].length, 3);

  // Clear: empty all
  strokes = [];
  assert.equal(strokes.length, 0);
});

test('Fast mobile signer bounding box calculation to PDF coordinates', () => {
  const pageDimensions = { width: 612, height: 792 };
  const strokes = [
    [
      { x: 100, y: 200 },
      { x: 250, y: 250 },
    ],
    [
      { x: 120, y: 220 },
      { x: 260, y: 270 },
    ],
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const pt of stroke) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  assert.equal(minX, 100);
  assert.equal(maxX, 260);
  assert.equal(minY, 200);
  assert.equal(maxY, 270);

  // PDF coordinates: PDF Y = pageHeight - maxY
  const pdfX = minX;
  const pdfY = pageDimensions.height - maxY;
  assert.equal(pdfX, 100);
  assert.equal(pdfY, 792 - 270); // 522
});

test('Fast signing confirmation validation: requires drawn signature, legal name, and terms agreement', () => {
  function validateFastSigning({ signatureDataUrl, signerName, agreedToTerms }) {
    if (!signatureDataUrl) {
      return { valid: false, error: 'Please use the Pen to draw your signature.' };
    }
    if (!signerName || !signerName.trim()) {
      return { valid: false, error: 'Please enter your full legal name.' };
    }
    if (!agreedToTerms) {
      return { valid: false, error: 'You must agree to the contract terms before sealing.' };
    }
    return { valid: true };
  }

  // Missing signature
  const res1 = validateFastSigning({ signatureDataUrl: null, signerName: 'Alice', agreedToTerms: true });
  assert.equal(res1.valid, false);
  assert.match(res1.error, /Pen/);

  // Missing name
  const res2 = validateFastSigning({ signatureDataUrl: SAMPLE_PNG_BASE64, signerName: '', agreedToTerms: true });
  assert.equal(res2.valid, false);
  assert.match(res2.error, /legal name/);

  // Missing terms agreement
  const res3 = validateFastSigning({ signatureDataUrl: SAMPLE_PNG_BASE64, signerName: 'Alice', agreedToTerms: false });
  assert.equal(res3.valid, false);
  assert.match(res3.error, /terms/);

  // Valid
  const res4 = validateFastSigning({ signatureDataUrl: SAMPLE_PNG_BASE64, signerName: 'Alice', agreedToTerms: true });
  assert.equal(res4.valid, true);
});

test('Fast mobile signing preserves existing template fields while stamping drawn signature', () => {
  const existingTemplateFields = [
    { id: 't-text', type: 'TEXT', page: 1, x: 50, y: 500, value: 'Company NDA' },
    { id: 't-initials', type: 'INITIALS', page: 1, x: 250, y: 115, value: 'JD' },
  ];

  const targetPage = 1;
  const targetSigX = 80;
  const targetSigY = 120;
  const targetWidth = 170;
  const targetHeight = 50;
  const signatureDataUrl = SAMPLE_PNG_BASE64;
  const today = '2026-10-07';

  const baseFields = existingTemplateFields.map((f) => {
    if (f.type === 'SIGNATURE') {
      return { ...f, page: targetPage, x: targetSigX, y: targetSigY, width: targetWidth, height: targetHeight, value: signatureDataUrl };
    }
    if (f.type === 'DATE') {
      return { ...f, page: targetPage, value: today };
    }
    return f;
  });

  const hasSigInBase = baseFields.some((f) => f.type === 'SIGNATURE');
  const submissionFields = hasSigInBase
    ? baseFields
    : [
        ...baseFields,
        {
          id: 'field-fast-sig',
          type: 'SIGNATURE',
          page: targetPage,
          x: targetSigX,
          y: targetSigY,
          width: targetWidth,
          height: targetHeight,
          value: signatureDataUrl,
          label: 'Client Signature',
          required: true,
        },
      ];

  assert.equal(submissionFields.length, 3);
  assert.equal(submissionFields.find((f) => f.type === 'TEXT')?.value, 'Company NDA');
  assert.equal(submissionFields.find((f) => f.type === 'INITIALS')?.value, 'JD');
  assert.equal(submissionFields.find((f) => f.type === 'SIGNATURE')?.value, SAMPLE_PNG_BASE64);
});

test('Viewport non-clipping margin: auto layout ensures start alignment when overflowing', () => {
  function computeLayoutOffsets(containerWidth, docWidth) {
    if (docWidth <= containerWidth) {
      // Centered with positive auto margins
      const margin = (containerWidth - docWidth) / 2;
      return { leftMargin: margin, canReachStart: true };
    } else {
      // Overflows: margins collapse to 0, document starts at x=0
      return { leftMargin: 0, canReachStart: true, maxScrollLeft: docWidth - containerWidth };
    }
  }

  // Desktop wide viewport: centered
  const desktop = computeLayoutOffsets(1200, 673);
  assert.equal(desktop.leftMargin, (1200 - 673) / 2);
  assert.equal(desktop.canReachStart, true);

  // Mobile small viewport (390px phone): starts at 0, no negative scroll clip
  const mobile = computeLayoutOffsets(390, 673);
  assert.equal(mobile.leftMargin, 0);
  assert.equal(mobile.canReachStart, true);
  assert.equal(mobile.maxScrollLeft, 283);
});

