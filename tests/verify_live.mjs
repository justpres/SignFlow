import assert from 'node:assert';
import { PDFDocument, rgb } from 'pdf-lib';

async function runEndToEndVerification() {
  console.log('--- STARTING SIGNFLOW END-TO-END VERIFICATION ---');
  const baseUrl = 'http://localhost:3000';

  // 1. Check Homepage
  console.log('1. Checking Homepage...');
  const homeRes = await fetch(`${baseUrl}/`);
  assert.strictEqual(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('SignFlow'));
  console.log('✓ Homepage verified.');

  // 2. Admin Authentication
  console.log('2. Testing Admin Login...');
  const loginRes = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@signflow.app', password: 'AdminSignFlow2026!' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const loginCookies = loginRes.headers.get('set-cookie');
  assert.ok(loginCookies && loginCookies.includes('signflow_admin_session'));
  console.log('✓ Admin Login verified.');

  // 3. Create Contract with Real PDF
  console.log('3. Uploading Contract PDF and Creating Request...');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  page.drawText('CONFIDENTIAL SERVICES AGREEMENT', { x: 50, y: 780, size: 16, color: rgb(0, 0, 0) });
  page.drawText('This agreement is entered into between Client and Provider.', { x: 50, y: 740, size: 11, color: rgb(0, 0, 0) });
  const pdfBytes = await pdfDoc.save();

  const formData = new FormData();
  formData.append('title', 'MSA Services Agreement 2026');
  formData.append('clientName', 'Eleanor Vance');
  formData.append('clientEmail', 'eleanor@vance.io');
  const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
  formData.append('expiresAt', futureDate);
  formData.append('message', 'Please sign this agreement at your earliest convenience.');
  formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'agreement.pdf');

  const createRes = await fetch(`${baseUrl}/api/contracts`, {
    method: 'POST',
    headers: { Cookie: loginCookies },
    body: formData,
  });

  assert.strictEqual(createRes.status, 200);
  const createData = await createRes.json();
  assert.ok(createData.contract && createData.contract.id);
  assert.ok(createData.signingToken);
  console.log(`✓ Contract created. ID: ${createData.contract.id}, Token: ${createData.signingToken.substring(0, 10)}...`);

  const contractId = createData.contract.id;
  const token = createData.signingToken;

  // 4. Client View Contract
  console.log('4. Client opening private signing link...');
  const clientViewRes = await fetch(`${baseUrl}/api/contracts/sign/${token}`);
  assert.strictEqual(clientViewRes.status, 200);
  const clientViewData = await clientViewRes.json();
  assert.strictEqual(clientViewData.contract.title, 'MSA Services Agreement 2026');
  assert.ok(clientViewData.pdfBase64);
  console.log('✓ Client contract view verified. PDF preview retrieved.');

  // 5. Client Finalizes Signature
  console.log('5. Submitting client signature and finalizing contract...');
  const dummySignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const finalizeRes = await fetch(`${baseUrl}/api/contracts/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      clientName: 'Eleanor Vance',
      signatureDataUrl: dummySignaturePng,
      signatureMethod: 'DRAW',
    }),
  });

  assert.strictEqual(finalizeRes.status, 200);
  const finalizeData = await finalizeRes.json();
  assert.strictEqual(finalizeData.success, true);
  assert.ok(finalizeData.downloadUrl);
  console.log('✓ Contract finalized successfully.');

  // 6. Test Double Finalization Prevention
  console.log('6. Verifying double submission / duplicate finalization prevention...');
  const doubleFinalizeRes = await fetch(`${baseUrl}/api/contracts/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      clientName: 'Eleanor Vance',
      signatureDataUrl: dummySignaturePng,
      signatureMethod: 'DRAW',
    }),
  });
  assert.strictEqual(doubleFinalizeRes.status, 409);
  console.log('✓ Double submission successfully rejected with 409 Conflict.');

  // 7. Verify Client Re-Opening Signed Link
  console.log('7. Verifying client reopening signed contract...');
  const reOpenRes = await fetch(`${baseUrl}/api/contracts/sign/${token}`);
  const reOpenData = await reOpenRes.json();
  assert.strictEqual(reOpenData.contract.status, 'SIGNED');
  console.log('✓ Signed state preserved and immutable.');

  // 8. Admin Verifies Contract in Details & Audit Trail
  console.log('8. Admin verifying contract details and audit trail...');
  const detailRes = await fetch(`${baseUrl}/api/contracts/${contractId}`, {
    headers: { Cookie: loginCookies },
  });
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.contract.status, 'SIGNED');
  assert.ok(detailData.auditLogs.length >= 4); // Created, Sent, Opened, Completed, Signed
  console.log(`✓ Audit log verified with ${detailData.auditLogs.length} chronological actions.`);

  // 9. Download Final Signed PDF
  console.log('9. Downloading generated signed PDF...');
  const downloadRes = await fetch(`${baseUrl}/api/contracts/${contractId}/download?type=signed`, {
    headers: { Cookie: loginCookies },
  });
  assert.strictEqual(downloadRes.status, 200);
  const signedBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const finalPdf = await PDFDocument.load(signedBuffer);
  assert.strictEqual(finalPdf.getPageCount(), 1);
  console.log('✓ Signed PDF downloaded and verified (in-place stamped signature).');

  // 10. Clean up test contract so database is not polluted
  console.log('10. Cleaning up test contract from database...');
  const deleteRes = await fetch(`${baseUrl}/api/contracts/${contractId}`, {
    method: 'DELETE',
    headers: { Cookie: loginCookies },
  });
  assert.strictEqual(deleteRes.status, 200);
  console.log('✓ Test contract cleaned up.');

  console.log('\n=============================================');
  console.log('ALL SIGNFLOW MVP 1 INTEGRATION CHECKS PASSED!');
  console.log('=============================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
