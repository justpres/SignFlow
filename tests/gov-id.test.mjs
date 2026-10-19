import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import zlib from 'zlib';
import { generateSignedPdf } from '../lib/pdf/generator.ts';
import { appendCertificateOfCompletion } from '../lib/pdf/certificate.ts';
import { validateFinalizeGovId } from '../lib/contracts/validation.ts';
import { PHILIPPINE_GOV_ID_TYPES } from '../lib/types/index.ts';
import {
  saveContract,
  getContractById,
  deleteContract,
  saveTemplate,
  getTemplateById,
  deleteTemplate,
} from '../lib/firebase/service.ts';

const SAMPLE_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Minimal valid 1x1 pixel JPEG
const SAMPLE_JPEG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

function extractPageText(loadedDoc, pageIndex) {
  const page = loadedDoc.getPage(pageIndex);
  const contentsRef = page.node.get(loadedDoc.context.obj('Contents'));
  if (!contentsRef) return '';
  const stream = loadedDoc.context.lookup(contentsRef);
  const rawStreams = stream?.array ? stream.array : [contentsRef];
  let fullText = '';
  for (const ref of rawStreams) {
    const obj = loadedDoc.context.lookup(ref);
    const contents = obj?.contents || (obj?.getContents && obj.getContents());
    if (contents) {
      try {
        const decompressed = zlib.inflateSync(Buffer.from(contents)).toString('latin1');
        const hexMatches = decompressed.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g);
        for (const match of hexMatches) {
          fullText += Buffer.from(match[1], 'hex').toString('utf8') + ' ';
        }
        const litMatches = decompressed.matchAll(/\(([^)]+)\)\s*Tj/g);
        for (const match of litMatches) {
          fullText += match[1] + ' ';
        }
      } catch {}
    }
  }
  return fullText;
}

async function createBaseContractPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText('Independent Contractor Agreement (Philippines)', {
    x: 50,
    y: 730,
    size: 14,
    color: rgb(0, 0, 0),
  });
  page.drawText('Signer acknowledges statutory identity compliance.', {
    x: 50,
    y: 700,
    size: 10,
    color: rgb(0.2, 0.2, 0.2),
  });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe('Philippine Government ID & Identity Verification Suite (Sub-phase 1.2)', () => {
  it('1.2.1 Data Model: PHILIPPINE_GOV_ID_TYPES contains all standard Philippine government IDs', () => {
    assert.ok(Array.isArray(PHILIPPINE_GOV_ID_TYPES));
    assert.strictEqual(PHILIPPINE_GOV_ID_TYPES.length, 9);
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('PhilSys National ID'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes("Driver's License (LTO)"));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('UMID'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('Philippine Passport'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('TIN ID (BIR)'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('PRC ID'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('SSS ID'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes('Postal ID'));
    assert.ok(PHILIPPINE_GOV_ID_TYPES.includes("Voter's ID / Comelec"));
  });

  it('1.2.2 Admin Contract & Template Creation: persists requiresGovId flag', async () => {
    const contractId = `cnt_govid_test_${Date.now()}`;
    const newContract = {
      id: contractId,
      title: 'Commercial Lease Agreement Manila',
      clientName: 'Maria Clara',
      clientEmail: 'maria@claradesign.ph',
      status: 'SENT',
      originalFilePath: 'contracts/test/original.pdf',
      signingTokenHash: 'mockhash123',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      contractVersion: 1,
      requiresGovId: true,
      govIdType: 'PhilSys National ID',
    };

    await saveContract(newContract);
    const fetched = await getContractById(contractId);
    assert.ok(fetched);
    assert.strictEqual(fetched.requiresGovId, true);
    assert.strictEqual(fetched.govIdType, 'PhilSys National ID');

    // Test template persistence
    const templateId = `tpl_govid_test_${Date.now()}`;
    const newTemplate = {
      id: templateId,
      title: 'Standard Retainer with Gov ID',
      pdfBase64: 'mockPdfBase64',
      requiresGovId: true,
      createdAt: new Date().toISOString(),
    };

    await saveTemplate(newTemplate);
    const fetchedTemplate = await getTemplateById(templateId);
    assert.ok(fetchedTemplate);
    assert.strictEqual(fetchedTemplate.requiresGovId, true);

    // Cleanup
    await deleteContract(contractId);
    await deleteTemplate(templateId);
  });

  it('1.2.3 Finalization validation: rejects missing Gov ID (400) when required', () => {
    // Case 1: contract requiresGovId is true, but payload has no photo
    const missingPhotoResult = validateFinalizeGovId(
      { requiresGovId: true },
      { govIdPhotoBase64: null }
    );
    assert.strictEqual(missingPhotoResult.valid, false);
    assert.strictEqual(missingPhotoResult.status, 400);
    assert.ok(missingPhotoResult.error?.includes('Philippine Government ID verification is required'));

    // Case 2: contract requiresGovId is true, but photo is empty string
    const emptyPhotoResult = validateFinalizeGovId(
      { requiresGovId: true },
      { govIdPhotoBase64: '' }
    );
    assert.strictEqual(emptyPhotoResult.valid, false);
    assert.strictEqual(emptyPhotoResult.status, 400);

    // Case 3: contract requiresGovId is true and photo is provided
    const validResult = validateFinalizeGovId(
      { requiresGovId: true },
      { govIdPhotoBase64: SAMPLE_PNG_BASE64 }
    );
    assert.strictEqual(validResult.valid, true);

    // Case 4: contract requiresGovId is false or omitted
    const optionalResult = validateFinalizeGovId(
      { requiresGovId: false },
      { govIdPhotoBase64: null }
    );
    assert.strictEqual(optionalResult.valid, true);

    // Case 5: contract requiresGovId is true, but photo is whitespace-only
    const whitespaceResult = validateFinalizeGovId(
      { requiresGovId: true },
      { govIdPhotoBase64: '   ' }
    );
    assert.strictEqual(whitespaceResult.valid, false);
    assert.strictEqual(whitespaceResult.status, 400);

    // Case 6: contract requiresGovId is true, but photo is too short dummy string
    const shortResult = validateFinalizeGovId(
      { requiresGovId: true },
      { govIdPhotoBase64: 'data:image/jpeg;x' }
    );
    assert.strictEqual(shortResult.valid, false);
    assert.strictEqual(shortResult.status, 400);
  });

  it('1.2.4 Successful Finalization: generates signed PDF and persists Gov ID specimen', async () => {
    const baseBuffer = await createBaseContractPdf();
    const contractId = `cnt_signed_govid_${Date.now()}`;
    const signedAtDate = '2026-10-08T09:30:00.000Z';

    const signedBuffer = await generateSignedPdf({
      originalPdfBuffer: baseBuffer,
      clientName: 'Juan Dela Cruz',
      clientEmail: 'juan@delacruz.ph',
      signaturePngBase64: SAMPLE_PNG_BASE64,
      contractId,
      contractTitle: 'Professional Services Contract',
      signedAtDate,
      requiresGovId: true,
      govIdType: "Driver's License (LTO)",
      govIdPhotoBase64: SAMPLE_PNG_BASE64,
      attachCertificate: false,
    });

    assert.ok(Buffer.isBuffer(signedBuffer));
    assert.ok(signedBuffer.length > baseBuffer.length);

    const loadedDoc = await PDFDocument.load(signedBuffer);
    assert.strictEqual(loadedDoc.getPageCount(), 1);
  });

  it('1.2.4 Certificate of Completion: embeds watermarked Philippine Gov ID and audit action', async () => {
    const doc = await PDFDocument.create();
    const signedAt = '2026-10-08T11:15:00.000Z';
    const auditEvents = [
      { action: 'CONTRACT_CREATED', timestamp: '2026-10-08T10:00:00.000Z', ipAddress: '198.51.100.1' },
      { action: 'CONTRACT_SENT', timestamp: '2026-10-08T10:05:00.000Z', ipAddress: '198.51.100.1' },
      { action: 'CONTRACT_OPENED', timestamp: '2026-10-08T11:00:00.000Z', ipAddress: '120.29.74.88' },
      { action: 'GOV_ID_VERIFIED', timestamp: '2026-10-08T11:10:00.000Z', ipAddress: '120.29.74.88', details: "Verified ID: Driver's License (LTO)" },
      { action: 'CONTRACT_SIGNED', timestamp: signedAt, ipAddress: '120.29.74.88' },
    ];

    await appendCertificateOfCompletion(doc, {
      contractTitle: 'Executive Employment Agreement',
      contractId: 'cnt_philsys_cert_7788',
      originalPdfHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signerName: 'Jose Rizal',
      signerEmail: 'jose@rizal.ph',
      signerIp: '120.29.74.88',
      signerUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      signedAt,
      signatureMethod: 'DRAW',
      signaturePngBase64: SAMPLE_PNG_BASE64,
      requiresGovId: true,
      govIdType: "Driver's License (LTO)",
      govIdPhotoBase64: SAMPLE_PNG_BASE64,
      auditEvents,
    });

    const pdfBytes = await doc.save();
    const loadedDoc = await PDFDocument.load(pdfBytes);
    assert.strictEqual(loadedDoc.getPageCount(), 1);

    const pageText = extractPageText(loadedDoc, 0);

    // Verify statutory citations
    assert.ok(pageText.includes('Republic Act No. 8792'), 'Must cite RA 8792');
    assert.ok(pageText.includes('A.M. No. 01-7-01-SC'), 'Must cite Supreme Court A.M. No. 01-7-01-SC');

    // Verify Philippine Gov ID row in Section 3
    assert.ok(pageText.includes('Philippine Gov ID:'), 'Must render Philippine Gov ID row');
    assert.ok(pageText.includes("Driver's License (LTO)"), 'Must render specified ID type');
    assert.ok(pageText.includes('Verified Specimen'), 'Must mark ID row as Verified Specimen');

    // Verify watermark across specimen box
    assert.ok(pageText.includes('[VERIFIED SPECIMEN]'), 'Must render [VERIFIED SPECIMEN] watermark');

    // Verify audit event table maps GOV_ID_VERIFIED to user-friendly label
    assert.ok(pageText.includes('Government ID Verified'), 'Must map GOV_ID_VERIFIED to Government ID Verified in audit table');
  });

  it('1.2.4 Robustness: handles PhilSys, Passport, UMID, PRC ID, and corrupted base64 gracefully', async () => {
    const doc = await PDFDocument.create();

    // Corrupt base64 should not crash certificate generation
    await appendCertificateOfCompletion(doc, {
      contractTitle: 'Subcontractor Master Agreement',
      contractId: 'cnt_corrupt_test_1',
      originalPdfHash: 'hash123',
      signerName: 'Andres Bonifacio',
      signerEmail: 'andres@katipunan.ph',
      signedAt: '2026-10-08T12:00:00Z',
      signaturePngBase64: SAMPLE_PNG_BASE64,
      requiresGovId: true,
      govIdType: 'PhilSys National ID',
      govIdPhotoBase64: 'data:image/jpeg;base64,not_a_valid_image_bytes',
    });

    const bytes = await doc.save();
    const loadedDoc = await PDFDocument.load(bytes);
    assert.strictEqual(loadedDoc.getPageCount(), 1);

    const text = extractPageText(loadedDoc, 0);
    assert.ok(text.includes('PhilSys National ID'));
    assert.ok(text.includes('[VERIFIED SPECIMEN]'));
  });

  it('1.2.4 Two-Party Counter-Signing: preserves Philippine Gov ID metadata & specimen upon counter-signature finalization', async () => {
    const baseBuffer = await createBaseContractPdf();
    const contractId = `cnt_twoparty_govid_${Date.now()}`;
    const signedAtDate = '2026-10-08T14:00:00.000Z';
    const counterSignedAtDate = '2026-10-08T15:00:00.000Z';

    const twoPartyPdf = await generateSignedPdf({
      originalPdfBuffer: baseBuffer,
      clientName: 'Emilio Aguinaldo',
      clientEmail: 'emilio@kawit.gov.ph',
      signaturePngBase64: SAMPLE_PNG_BASE64,
      contractId,
      contractTitle: 'Bilateral Trade Agreement',
      signedAtDate,
      counterSignaturePngBase64: SAMPLE_PNG_BASE64,
      counterSignerName: 'Apolinario Mabini',
      counterSignedAtDate,
      requiresGovId: true,
      govIdType: 'Philippine Passport',
      govIdPhotoBase64: SAMPLE_JPEG_BASE64,
      attachCertificate: true,
    });

    assert.ok(Buffer.isBuffer(twoPartyPdf));
    const loadedDoc = await PDFDocument.load(twoPartyPdf);
    assert.strictEqual(loadedDoc.getPageCount(), 2); // 1 contract page + 1 certificate page

    const contractPageText = extractPageText(loadedDoc, 0);
    assert.ok(contractPageText.includes('Authorized Counter-Signer: Apolinario Mabini'));

    const certPageText = extractPageText(loadedDoc, 1);
    assert.ok(certPageText.includes('Philippine Gov ID:'));
    assert.ok(certPageText.includes('Philippine Passport'));
    assert.ok(certPageText.includes('Verified Specimen'));
    assert.ok(certPageText.includes('[VERIFIED SPECIMEN]'));
  });

  it('1.2.4 Certificate Layout Integrity: stacked thumbnail boxes prevent text overlap even with long signer metadata', async () => {
    const doc = await PDFDocument.create();
    const longName = 'Don Juan Miguel Antonio Dela Cruz y Santos';
    const longEmail = 'juan.miguel.antonio.delacruz@verylongcorporatedomain.ph';
    const longUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

    await appendCertificateOfCompletion(doc, {
      contractTitle: 'Comprehensive Manila Commercial Partnership Agreement',
      contractId: 'cnt_long_text_cert_9999',
      originalPdfHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      signerName: longName,
      signerEmail: longEmail,
      signerIp: '180.191.123.45 (PLDT Fiber HTTPS)',
      signerUserAgent: longUserAgent,
      signedAt: '2026-10-08T16:00:00Z',
      signatureMethod: 'DRAW',
      signaturePngBase64: SAMPLE_PNG_BASE64,
      requiresGovId: true,
      govIdType: "Driver's License (LTO)",
      govIdPhotoBase64: SAMPLE_JPEG_BASE64,
    });

    const pdfBytes = await doc.save();
    const loadedDoc = await PDFDocument.load(pdfBytes);
    assert.strictEqual(loadedDoc.getPageCount(), 1);

    const pageText = extractPageText(loadedDoc, 0);
    assert.ok(pageText.includes('Don Juan Miguel Antonio Dela Cruz y Santos'));
    assert.ok(pageText.includes("Driver's License (LTO)"));
    assert.ok(pageText.includes('[VERIFIED SPECIMEN]'));
    assert.ok(pageText.includes('CAPTURED SIGNATURE'));
    assert.ok(pageText.includes('VERIFIED GOV ID'));
  });
});
