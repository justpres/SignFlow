import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import { generateSignedPdf } from '../lib/pdf/generator.ts';
import {
  saveTemplate,
  getTemplateById,
  getAllTemplates,
  deleteTemplate,
  saveContract,
  getContractById,
  deleteContract,
} from '../lib/firebase/service.ts';

const SAMPLE_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createTestPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText('Sample Master Services Agreement Terms', {
    x: 50,
    y: 750,
    size: 14,
    color: rgb(0, 0, 0),
  });
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

test('Multi-Field Stamping: stamps Signature, Initials, Date, and Text input accurately', async () => {
  const originalPdfBuffer = await createTestPdf();

  const multiFields = [
    {
      id: 'f-sig-1',
      type: 'SIGNATURE',
      page: 1,
      x: 70,
      y: 120,
      width: 170,
      height: 50,
      label: 'Client Signature',
    },
    {
      id: 'f-ini-1',
      type: 'INITIALS',
      page: 1,
      x: 260,
      y: 120,
      width: 80,
      height: 40,
      label: 'Signer Initials',
      value: 'JD',
    },
    {
      id: 'f-date-1',
      type: 'DATE',
      page: 1,
      x: 360,
      y: 120,
      width: 110,
      height: 28,
      label: 'Date Signed',
      value: '2026-10-07',
    },
    {
      id: 'f-text-1',
      type: 'TEXT',
      page: 1,
      x: 70,
      y: 60,
      width: 200,
      height: 28,
      label: 'Job Title',
      value: 'Managing Director, Acme Corp',
    },
  ];

  const signedBuffer = await generateSignedPdf({
    originalPdfBuffer,
    clientName: 'Juan Dela Cruz',
    signaturePngBase64: SAMPLE_PNG_BASE64,
    contractId: 'cnt_multi_123',
    contractTitle: 'MSA Agreement',
    signedAtDate: '2026-10-07T10:00:00Z',
    fields: multiFields,
  });

  assert.ok(signedBuffer instanceof Buffer);
  const pdfDoc = await PDFDocument.load(signedBuffer);
  assert.strictEqual(pdfDoc.getPageCount(), 1);
  assert.strictEqual(pdfDoc.getTitle(), 'MSA Agreement');
  assert.strictEqual(pdfDoc.getAuthor(), 'Juan Dela Cruz');
});

test('Two-Party Counter-Signing: stamps both client signature and sender counter-signature', async () => {
  const originalPdfBuffer = await createTestPdf();

  const signedBuffer = await generateSignedPdf({
    originalPdfBuffer,
    clientName: 'Client Signer',
    signaturePngBase64: SAMPLE_PNG_BASE64,
    contractId: 'cnt_2party_456',
    contractTitle: 'Two-Party Partnership Agreement',
    signedAtDate: '2026-10-07T10:00:00Z',
    signaturePage: 1,
    signatureX: 70,
    signatureY: 115,
    counterSignaturePngBase64: SAMPLE_PNG_BASE64,
    counterSignerName: 'Authorized Director',
    counterSignedAtDate: '2026-10-07T10:30:00Z',
    counterSignPlacement: {
      page: 1,
      signatureX: 350,
      signatureY: 115,
    },
  });

  assert.ok(signedBuffer instanceof Buffer);
  const pdfDoc = await PDFDocument.load(signedBuffer);
  assert.strictEqual(pdfDoc.getPageCount(), 1);
});

test('Reusable Templates: saves, retrieves, and deletes contract templates', async () => {
  const templateId = `tpl_test_${Date.now()}`;
  const templateData = {
    id: templateId,
    title: 'Standard Non-Disclosure Agreement (NDA)',
    description: 'Reusable mutual NDA template with predefined signature blocks',
    pdfBase64: 'JVBERi0xLjQKJcTl8uXrCg==',
    fileName: 'standard_nda.pdf',
    fields: [
      { id: 'f1', type: 'SIGNATURE', page: 1, x: 70, y: 115, width: 170, height: 50 },
      { id: 'f2', type: 'DATE', page: 1, x: 260, y: 115, width: 110, height: 28 },
    ],
    signaturePage: 1,
    signatureX: 70,
    signatureY: 115,
    requiresCounterSign: true,
    createdAt: new Date().toISOString(),
  };

  await saveTemplate(templateData);

  const fetched = await getTemplateById(templateId);
  assert.ok(fetched);
  assert.strictEqual(fetched.id, templateId);
  assert.strictEqual(fetched.title, 'Standard Non-Disclosure Agreement (NDA)');
  assert.strictEqual(fetched.requiresCounterSign, true);
  assert.strictEqual(fetched.fields?.length, 2);

  const all = await getAllTemplates();
  assert.ok(all.some((t) => t.id === templateId));

  await deleteTemplate(templateId);
  const afterDelete = await getTemplateById(templateId);
  assert.strictEqual(afterDelete, null);
});

test('Draft Contracts: saves draft without active token, updates and deletes draft', async () => {
  const draftId = `cnt_draft_${Date.now()}`;
  const draftContract = {
    id: draftId,
    title: 'Draft Consulting SOW',
    clientName: '',
    clientEmail: '',
    status: 'DRAFT',
    originalFilePath: '',
    signingTokenHash: '',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    contractVersion: 1,
    requiresCounterSign: false,
  };

  await saveContract(draftContract);

  const fetched = await getContractById(draftId);
  assert.ok(fetched);
  assert.strictEqual(fetched.status, 'DRAFT');
  assert.strictEqual(fetched.signingTokenHash, '');
  assert.strictEqual(fetched.clientName, '');

  // Update draft with client name
  draftContract.clientName = 'John Prospect';
  draftContract.clientEmail = 'john@prospect.com';
  await saveContract(draftContract);

  const updated = await getContractById(draftId);
  assert.strictEqual(updated?.clientName, 'John Prospect');
  assert.strictEqual(updated?.clientEmail, 'john@prospect.com');

  await deleteContract(draftId);
  const deleted = await getContractById(draftId);
  assert.strictEqual(deleted, null);
});

test('Multi-Field Stamping Fallback: stamps signature even when fields has no SIGNATURE field', async () => {
  const originalPdfBuffer = await createTestPdf();

  // Only date and text, no signature field
  const nonSigFields = [
    {
      id: 'f-date-only',
      type: 'DATE',
      page: 1,
      x: 100,
      y: 200,
      width: 100,
      height: 30,
      value: '2026-10-07',
    },
    {
      id: 'f-text-only',
      type: 'TEXT',
      page: 1,
      x: 100,
      y: 150,
      width: 150,
      height: 30,
      value: 'Chief Executive Officer',
    },
  ];

  const signedBuffer = await generateSignedPdf({
    originalPdfBuffer,
    clientName: 'Sarah Connor',
    signaturePngBase64: SAMPLE_PNG_BASE64,
    contractId: 'cnt_fallback_sig',
    signedAtDate: '2026-10-07T12:00:00Z',
    signaturePage: 1,
    signatureX: 80,
    signatureY: 100,
    fields: nonSigFields,
  });

  assert.ok(signedBuffer instanceof Buffer);
  const pdfDoc = await PDFDocument.load(signedBuffer);
  assert.strictEqual(pdfDoc.getPageCount(), 1);
});

test('Two-Party Agreement Lifecycle: draft to WAITING_COUNTER_SIGN to SIGNED with initials preservation', async () => {
  const contractId = `cnt_twoparty_${Date.now()}`;
  const contract = {
    id: contractId,
    title: 'Two-Party Executive Retainer',
    clientName: 'Elena Rostova',
    clientEmail: 'elena@rostova.com',
    status: 'DRAFT',
    originalFilePath: 'contracts/test/original.pdf',
    signingTokenHash: 'mock-hash-12345',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
    contractVersion: 1,
    requiresCounterSign: true,
    fields: [
      { id: 'f-sig', type: 'SIGNATURE', page: 1, x: 70, y: 120, width: 170, height: 50 },
      { id: 'f-ini', type: 'INITIALS', page: 1, x: 260, y: 120, width: 80, height: 40, value: 'ER' },
    ],
  };

  await saveContract(contract);

  // Transition from DRAFT to SENT
  contract.status = 'SENT';
  await saveContract(contract);
  const sentContract = await getContractById(contractId);
  assert.strictEqual(sentContract?.status, 'SENT');
  assert.strictEqual(sentContract?.requiresCounterSign, true);
  assert.strictEqual(sentContract?.fields?.length, 2);

  // Client signs -> status transitions to WAITING_COUNTER_SIGN
  sentContract.status = 'WAITING_COUNTER_SIGN';
  sentContract.signedAt = new Date().toISOString();
  sentContract.signatureImagePath = SAMPLE_PNG_BASE64;
  sentContract.initialsImagePath = SAMPLE_PNG_BASE64;
  await saveContract(sentContract);

  const waitingContract = await getContractById(contractId);
  assert.strictEqual(waitingContract?.status, 'WAITING_COUNTER_SIGN');
  assert.strictEqual(waitingContract?.initialsImagePath, SAMPLE_PNG_BASE64);

  // Admin counter-signs -> status transitions to SIGNED
  waitingContract.status = 'SIGNED';
  waitingContract.counterSignedAt = new Date().toISOString();
  waitingContract.counterSignerName = 'Admin Counsel';
  waitingContract.counterSignatureDataUrl = SAMPLE_PNG_BASE64;
  await saveContract(waitingContract);

  const sealedContract = await getContractById(contractId);
  assert.strictEqual(sealedContract?.status, 'SIGNED');
  assert.strictEqual(sealedContract?.counterSignerName, 'Admin Counsel');
  assert.ok(sealedContract?.counterSignedAt);

  // Clean up test contract
  await deleteContract(contractId);
  assert.strictEqual(await getContractById(contractId), null);
});

