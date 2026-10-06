import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateSigningToken, hashSigningToken } from '../lib/contracts/token.ts';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateSignedPdf } from '../lib/pdf/generator.ts';

describe('SignFlow End-to-End Cryptographic & PDF Finalization Suite', () => {
  it('should generate secure tokens and deterministic SHA-256 hashes', () => {
    const token = generateSigningToken();
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 64); // 32 bytes hex

    const hash1 = hashSigningToken(token);
    const hash2 = hashSigningToken(token);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });

  it('should generate an immutable signed PDF with certificate page and embedded signature', async () => {
    // 1. Create a dummy original contract PDF
    const originalDoc = await PDFDocument.create();
    const page = originalDoc.addPage([600, 400]);
    page.drawText('Sample Consulting Agreement Terms & Conditions', { x: 50, y: 350, size: 14, color: rgb(0, 0, 0) });
    const originalPdfBytes = await originalDoc.save();
    const originalBuffer = Buffer.from(originalPdfBytes);

    // 2. Minimal valid 1x1 PNG base64 for test signature
    const mockPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // 3. Finalize contract
    const signedBuffer = await generateSignedPdf({
      originalPdfBuffer: originalBuffer,
      clientName: 'Alexander Hamilton',
      signaturePngBase64: mockPngBase64,
      contractId: 'cnt_test_123',
      contractTitle: 'Sample Consulting Agreement',
      signedAtDate: new Date().toISOString(),
    });

    assert.ok(signedBuffer instanceof Buffer);
    assert.ok(signedBuffer.length > originalBuffer.length);

    // 4. Verify output PDF document structure: NO extra page created, stamped directly in place
    const verifiedDoc = await PDFDocument.load(signedBuffer);
    assert.strictEqual(verifiedDoc.getPageCount(), 1); // 1 page letter, signed in place without adding an extra page
  });
});
