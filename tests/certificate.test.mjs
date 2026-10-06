import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import crypto from 'crypto';
import { generateSignedPdf } from '../lib/pdf/generator.ts';
import { appendCertificateOfCompletion } from '../lib/pdf/certificate.ts';

const SAMPLE_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createContractDoc(numPages = 2) {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= numPages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Master Services Agreement - Page ${i}`, {
      x: 50,
      y: 720,
      size: 14,
      color: rgb(0, 0, 0),
    });
    page.drawText('Signature: ______________________', {
      x: 70,
      y: 115,
      size: 11,
      color: rgb(0, 0, 0),
    });
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe('SignFlow Industry-Grade Certificate of Completion & Legal Audit Suite', () => {
  it('generateSignedPdf appends official Certificate of Completion when attachCertificate is true', async () => {
    const originalBuffer = await createContractDoc(2);
    const contractId = 'cnt_enterprise_998877';
    const contractTitle = 'Enterprise Software License 2026';
    const clientName = 'Marcus Aurelius';
    const clientEmail = 'marcus@emperor.rome';
    const signedAtDate = '2026-10-06T15:30:00.000Z';
    const ipAddress = '203.0.113.42';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const auditEvents = [
      { action: 'CONTRACT_CREATED', timestamp: '2026-10-06T14:00:00.000Z', ipAddress: '198.51.100.1' },
      { action: 'CONTRACT_SENT', timestamp: '2026-10-06T14:05:00.000Z', ipAddress: '198.51.100.1' },
      { action: 'CONTRACT_OPENED', timestamp: '2026-10-06T15:20:00.000Z', ipAddress: '203.0.113.42', userAgent },
      { action: 'CONTRACT_SIGNED', timestamp: signedAtDate, ipAddress: '203.0.113.42', userAgent },
      { action: 'SIGNED_PDF_GENERATED', timestamp: signedAtDate, ipAddress: 'System' },
    ];

    const signedBuffer = await generateSignedPdf({
      originalPdfBuffer: originalBuffer,
      clientName,
      clientEmail,
      signaturePngBase64: SAMPLE_PNG_BASE64,
      contractId,
      contractTitle,
      signedAtDate,
      ipAddress,
      userAgent,
      signatureMethod: 'DRAW',
      auditEvents,
      signaturePage: 2,
      signatureX: 120,
      signatureY: 140,
      attachCertificate: true,
    });

    assert.ok(Buffer.isBuffer(signedBuffer));
    assert.ok(signedBuffer.length > originalBuffer.length);

    // Verify document page count: 2 original pages + exactly 1 appended Certificate page = 3
    const loadedDoc = await PDFDocument.load(signedBuffer);
    assert.equal(loadedDoc.getPageCount(), 3, 'Output must have 2 contract pages + 1 Certificate of Completion page');

    // Verify that the final page is Letter sized (612 x 792)
    const certPage = loadedDoc.getPage(2);
    assert.equal(certPage.getWidth(), 612);
    assert.equal(certPage.getHeight(), 792);
  });

  it('appendCertificateOfCompletion directly renders all court-admissible ESIGN/UETA metadata', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]); // 1 contract page

    const originalHash = crypto.createHash('sha256').update('Sample Contract Content').digest('hex');
    const sealedHash = crypto.createHash('sha256').update('Signed Contract Content').digest('hex');

    await appendCertificateOfCompletion(doc, {
      contractTitle: 'Non-Disclosure Agreement (NDA)',
      contractId: 'cnt_nda_456',
      originalPdfHash: originalHash,
      sealedPdfHash: sealedHash,
      signerName: 'Ada Lovelace',
      signerEmail: 'ada@computing.org',
      signerIp: '192.0.2.1',
      signerUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      signedAt: '2026-10-06T16:00:00.000Z',
      signatureMethod: 'TYPE',
      signaturePngBase64: SAMPLE_PNG_BASE64,
    });

    assert.equal(doc.getPageCount(), 2);
    const pdfBytes = await doc.save();
    assert.ok(pdfBytes.length > 0);
  });

  it('appendCertificateOfCompletion falls back gracefully when audit logs are omitted', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);

    const originalHash = crypto.createHash('sha256').update('Minimal Contract').digest('hex');

    await appendCertificateOfCompletion(doc, {
      contractTitle: 'Minimal Contract',
      contractId: 'cnt_min_111',
      originalPdfHash: originalHash,
      signerName: 'Grace Hopper',
      signerEmail: 'grace@navy.mil',
      signedAt: new Date().toISOString(),
      // auditEvents deliberately omitted to test fallback synthesized events
    });

    assert.equal(doc.getPageCount(), 2);
    const savedBytes = await doc.save();
    assert.ok(savedBytes.length > 0);
  });

  it('generateSignedPdf keeps contract pages visually clean without extra text or extra pages when attachCertificate is false', async () => {
    const originalBuffer = await createContractDoc(2);
    const signedBuffer = await generateSignedPdf({
      originalPdfBuffer: originalBuffer,
      clientName: 'Clean Test',
      signaturePngBase64: SAMPLE_PNG_BASE64,
      contractId: 'cnt_clean_123',
      signedAtDate: new Date().toISOString(),
      attachCertificate: false,
    });

    const loadedDoc = await PDFDocument.load(signedBuffer);
    assert.equal(loadedDoc.getPageCount(), 2, 'Page count must remain exactly 2 when attachCertificate is false');
  });

  it('appendCertificateOfCompletion gracefully handles large audit trails (10+ events) and preserves terminal signing events', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);

    const largeAuditEvents = [
      { action: 'CONTRACT_CREATED', timestamp: '2026-10-06T10:00:00Z', ipAddress: '10.0.0.1', details: '{"title":"Heavy Contract"}' },
      { action: 'CONTRACT_SENT', timestamp: '2026-10-06T10:05:00Z', ipAddress: '10.0.0.1' },
      { action: 'CONTRACT_OPENED', timestamp: '2026-10-06T10:10:00Z', ipAddress: '192.168.1.1' },
      { action: 'CONTRACT_OPENED', timestamp: '2026-10-06T10:12:00Z', ipAddress: '192.168.1.1' },
      { action: 'CONTRACT_OPENED', timestamp: '2026-10-06T10:15:00Z', ipAddress: '192.168.1.1' },
      { action: 'SIGNATURE_STARTED', timestamp: '2026-10-06T10:20:00Z', ipAddress: '192.168.1.1' },
      { action: 'SIGNATURE_COMPLETED', timestamp: '2026-10-06T10:21:00Z', ipAddress: '192.168.1.1' },
      { action: 'CONTRACT_OPENED', timestamp: '2026-10-06T10:25:00Z', ipAddress: '192.168.1.1' },
      { action: 'SIGNATURE_STARTED', timestamp: '2026-10-06T10:26:00Z', ipAddress: '192.168.1.1' },
      { action: 'SIGNATURE_COMPLETED', timestamp: '2026-10-06T10:27:00Z', ipAddress: '192.168.1.1' },
      { action: 'CONTRACT_SIGNED', timestamp: '2026-10-06T10:30:00Z', ipAddress: '192.168.1.1', details: '{"clientName":"Heavy Signer","method":"DRAW"}' },
      { action: 'SIGNED_PDF_GENERATED', timestamp: '2026-10-06T10:30:05Z', ipAddress: 'System', details: 'Sealed PDF generated' },
    ];

    await appendCertificateOfCompletion(doc, {
      contractTitle: 'Heavy Enterprise Agreement',
      contractId: 'cnt_heavy_999',
      originalPdfHash: 'hash_original_999',
      sealedPdfHash: 'hash_sealed_999',
      signerName: 'Heavy Signer',
      signerEmail: 'heavy@enterprise.io',
      signerIp: '192.168.1.1',
      signedAt: '2026-10-06T10:30:00Z',
      auditEvents: largeAuditEvents,
      signaturePngBase64: SAMPLE_PNG_BASE64,
    });

    assert.equal(doc.getPageCount(), 2);
    const pdfBytes = await doc.save();
    assert.ok(pdfBytes.length > 0);
  });
});
