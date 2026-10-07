import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveUser,
  getUserById,
  getUserByEmail,
  saveContract,
  getContractById,
  getAllContracts,
  deleteContract,
  saveTemplate,
  getTemplateById,
  getAllTemplates,
  deleteTemplate,
} from '../lib/firebase/service.ts';

test('SaaS Multi-Tenant: User creation, retrieval, and updating', async () => {
  const timestamp = Date.now();
  const testUserId = `usr_test_${timestamp}`;
  const testEmail = `alice_${timestamp}@example.com`;
  const testUser = {
    id: testUserId,
    email: testEmail,
    name: 'Alice Smith',
    photoUrl: 'https://example.com/avatar-alice.png',
    createdAt: new Date().toISOString(),
  };

  await saveUser(testUser);

  // Retrieve by ID
  const retrievedById = await getUserById(testUserId);
  assert.ok(retrievedById, 'User should be found by ID');
  assert.equal(retrievedById.id, testUserId);
  assert.equal(retrievedById.email, testEmail);
  assert.equal(retrievedById.name, 'Alice Smith');
  assert.equal(retrievedById.photoUrl, 'https://example.com/avatar-alice.png');

  // Retrieve by Email (case-insensitive)
  const retrievedByEmail = await getUserByEmail(testEmail.toUpperCase());
  assert.ok(retrievedByEmail, 'User should be found by uppercase email');
  assert.equal(retrievedByEmail.id, testUserId);

  // Update User
  await saveUser({
    ...testUser,
    name: 'Alice Smith, CEO',
  });
  const updatedUser = await getUserById(testUserId);
  assert.equal(updatedUser.name, 'Alice Smith, CEO');
});

test('SaaS Multi-Tenant: Contract isolation between different users', async () => {
  const aliceUserId = `usr_alice_${Date.now()}`;
  const bobUserId = `usr_bob_${Date.now()}`;

  const contractAlice = {
    id: `cnt_alice_${Date.now()}`,
    title: 'Alice MSA Agreement',
    clientName: 'Acme Corp',
    clientEmail: 'client@acme.com',
    status: 'SENT',
    originalFilePath: 'contracts/test-alice.pdf',
    signingTokenHash: 'hash_alice_123',
    userId: aliceUserId,
    ownerEmail: 'alice@example.com',
    ownerName: 'Alice Smith',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    contractVersion: 1,
  };

  const contractBob = {
    id: `cnt_bob_${Date.now()}`,
    title: 'Bob Consulting Contract',
    clientName: 'Beta LLC',
    clientEmail: 'client@beta.com',
    status: 'SENT',
    originalFilePath: 'contracts/test-bob.pdf',
    signingTokenHash: 'hash_bob_456',
    userId: bobUserId,
    ownerEmail: 'bob@example.com',
    ownerName: 'Bob Johnson',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    contractVersion: 1,
  };

  await saveContract(contractAlice);
  await saveContract(contractBob);

  // Alice queries her contracts
  const aliceContracts = await getAllContracts(aliceUserId);
  assert.ok(aliceContracts.some((c) => c.id === contractAlice.id), "Alice's contracts must contain Contract Alice");
  assert.ok(!aliceContracts.some((c) => c.id === contractBob.id), "Alice's contracts must NOT contain Bob's contract");

  // Bob queries his contracts
  const bobContracts = await getAllContracts(bobUserId);
  assert.ok(bobContracts.some((c) => c.id === contractBob.id), "Bob's contracts must contain Contract Bob");
  assert.ok(!bobContracts.some((c) => c.id === contractAlice.id), "Bob's contracts must NOT contain Alice's contract");

  // Fallback / Admin queries all contracts (without userId parameter)
  const allContracts = await getAllContracts();
  assert.ok(allContracts.some((c) => c.id === contractAlice.id), 'Unfiltered contracts must contain Contract Alice');
  assert.ok(allContracts.some((c) => c.id === contractBob.id), 'Unfiltered contracts must contain Contract Bob');

  // Verify owner metadata was preserved
  const fetchedAlice = await getContractById(contractAlice.id);
  assert.equal(fetchedAlice?.userId, aliceUserId);
  assert.equal(fetchedAlice?.ownerEmail, 'alice@example.com');
  assert.equal(fetchedAlice?.ownerName, 'Alice Smith');

  // Cleanup
  await deleteContract(contractAlice.id);
  await deleteContract(contractBob.id);
});

test('SaaS Multi-Tenant: Template isolation between different users', async () => {
  const aliceUserId = `usr_alice_tpl_${Date.now()}`;
  const bobUserId = `usr_bob_tpl_${Date.now()}`;

  const templateAlice = {
    id: `tpl_alice_${Date.now()}`,
    title: 'Alice Standard NDA',
    pdfBase64: 'JVBERi0xLjQKJcfsj6IKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq',
    userId: aliceUserId,
    ownerEmail: 'alice@example.com',
    ownerName: 'Alice Smith',
    createdAt: new Date().toISOString(),
  };

  const templateBob = {
    id: `tpl_bob_${Date.now()}`,
    title: 'Bob Freelance Agreement',
    pdfBase64: 'JVBERi0xLjQKJcfsj6IKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq',
    userId: bobUserId,
    ownerEmail: 'bob@example.com',
    ownerName: 'Bob Johnson',
    createdAt: new Date().toISOString(),
  };

  await saveTemplate(templateAlice);
  await saveTemplate(templateBob);

  // Alice queries her templates
  const aliceTemplates = await getAllTemplates(aliceUserId);
  assert.ok(aliceTemplates.some((t) => t.id === templateAlice.id), "Alice's templates must contain Template Alice");
  assert.ok(!aliceTemplates.some((t) => t.id === templateBob.id), "Alice's templates must NOT contain Bob's template");

  // Bob queries his templates
  const bobTemplates = await getAllTemplates(bobUserId);
  assert.ok(bobTemplates.some((t) => t.id === templateBob.id), "Bob's templates must contain Template Bob");
  assert.ok(!bobTemplates.some((t) => t.id === templateAlice.id), "Bob's templates must NOT contain Alice's template");

  // Unfiltered / Admin query
  const allTemplates = await getAllTemplates();
  assert.ok(allTemplates.some((t) => t.id === templateAlice.id), 'Unfiltered templates must contain Template Alice');
  assert.ok(allTemplates.some((t) => t.id === templateBob.id), 'Unfiltered templates must contain Template Bob');

  // Cleanup
  await deleteTemplate(templateAlice.id);
  await deleteTemplate(templateBob.id);
});

test('SaaS Multi-Tenant: Strict ownership authorization and unowned contract protection', async () => {
  const { isContractOwner, isTemplateOwner, isGlobalAdmin } = await import('../lib/auth/permissions.ts');

  const aliceSession = { userId: 'usr_alice_123', email: 'alice@example.com' };
  const bobSession = { userId: 'usr_bob_456', email: 'bob@example.com' };
  const adminSession = { userId: 'usr_admin_000', email: 'admin@signflow.app' };

  const aliceContract = {
    userId: 'usr_alice_123',
    ownerEmail: 'alice@example.com',
  };

  const bobContract = {
    userId: 'usr_bob_456',
    ownerEmail: 'bob@example.com',
  };

  const unownedContract = {
    userId: undefined,
    ownerEmail: undefined,
  };

  // Alice owns her contract
  assert.equal(isContractOwner(aliceSession, aliceContract), true, 'Alice should own her contract');

  // Bob does NOT own Alice contract
  assert.equal(isContractOwner(bobSession, aliceContract), false, 'Bob must NOT own Alice contract');

  // Alice does NOT own Bob contract
  assert.equal(isContractOwner(aliceSession, bobContract), false, 'Alice must NOT own Bob contract');

  // CRITICAL: Unowned / legacy contract must NOT be accessible to regular tenants
  assert.equal(isContractOwner(aliceSession, unownedContract), false, 'Tenant Alice must NOT own unowned contracts');
  assert.equal(isContractOwner(bobSession, unownedContract), false, 'Tenant Bob must NOT own unowned contracts');

  // Global admin can manage all contracts including unowned contracts
  assert.equal(isContractOwner(adminSession, aliceContract), true, 'Admin should manage Alice contract');
  assert.equal(isContractOwner(adminSession, unownedContract), true, 'Admin should manage unowned contract');

  // Case-insensitivity: Alice with mixed-case session email
  const mixedCaseAlice = { userId: 'usr_different', email: 'ALICE@EXAMPLE.COM' };
  assert.equal(isContractOwner(mixedCaseAlice, aliceContract), true, 'Case-insensitive email match should authorize');

  // Templates authorization
  const aliceTemplate = { userId: 'usr_alice_123', ownerEmail: 'alice@example.com' };
  assert.equal(isTemplateOwner(aliceSession, aliceTemplate), true, 'Alice should own her template');
  assert.equal(isTemplateOwner(bobSession, aliceTemplate), false, 'Bob must NOT own Alice template');
  assert.equal(isTemplateOwner(bobSession, { userId: undefined, ownerEmail: undefined }), false, 'Bob must NOT own unowned template');
  assert.equal(isTemplateOwner(adminSession, aliceTemplate), true, 'Admin can manage all templates');

  // Global admin verification
  assert.equal(isGlobalAdmin('admin@signflow.app'), true);
  assert.equal(isGlobalAdmin('ADMIN@SIGNFLOW.APP'), true);
  assert.equal(isGlobalAdmin('alice@example.com'), false);
});

test('SaaS Multi-Tenant: Query fallback, deduplication, and email matching for contracts and templates', async () => {
  const ts = Date.now();
  const aliceId = `usr_alice_dedup_${ts}`;
  const aliceEmail = `alice_dedup_${ts}@example.com`;
  const bobId = `usr_bob_dedup_${ts}`;
  const bobEmail = `bob_dedup_${ts}@example.com`;

  // Contract with userId only
  const c1 = {
    id: `cnt_1_${ts}`,
    title: 'Contract 1 (userId)',
    clientName: 'Client 1',
    clientEmail: 'c1@example.com',
    status: 'SENT',
    originalFilePath: 'test.pdf',
    signingTokenHash: `hash_1_${ts}`,
    userId: aliceId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    contractVersion: 1,
  };

  // Contract with matching ownerEmail only (legacy / unmigrated)
  const c2 = {
    id: `cnt_2_${ts}`,
    title: 'Contract 2 (ownerEmail)',
    clientName: 'Client 2',
    clientEmail: 'c2@example.com',
    status: 'SENT',
    originalFilePath: 'test.pdf',
    signingTokenHash: `hash_2_${ts}`,
    ownerEmail: aliceEmail,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    contractVersion: 1,
  };

  // Contract with BOTH userId and ownerEmail (must not duplicate)
  const c3 = {
    id: `cnt_3_${ts}`,
    title: 'Contract 3 (both)',
    clientName: 'Client 3',
    clientEmail: 'c3@example.com',
    status: 'SENT',
    originalFilePath: 'test.pdf',
    signingTokenHash: `hash_3_${ts}`,
    userId: aliceId,
    ownerEmail: aliceEmail,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    contractVersion: 1,
  };

  // Bob contract
  const cBob = {
    id: `cnt_bob_${ts}`,
    title: 'Bob Contract',
    clientName: 'Client Bob',
    clientEmail: 'cbob@example.com',
    status: 'SENT',
    originalFilePath: 'test.pdf',
    signingTokenHash: `hash_bob_${ts}`,
    userId: bobId,
    ownerEmail: bobEmail,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    contractVersion: 1,
  };

  await saveContract(c1);
  await saveContract(c2);
  await saveContract(c3);
  await saveContract(cBob);

  const results = await getAllContracts(aliceId, aliceEmail);
  const ids = results.map(r => r.id);

  assert.ok(ids.includes(c1.id), 'Must include contract with userId');
  assert.ok(ids.includes(c2.id), 'Must include contract with matching ownerEmail');
  assert.ok(ids.includes(c3.id), 'Must include contract with both');
  assert.ok(!ids.includes(cBob.id), 'Must NOT include Bob contract');

  // Verify deduplication: c3 should appear exactly once
  const c3Count = ids.filter(id => id === c3.id).length;
  assert.equal(c3Count, 1, 'Contract with both userId and ownerEmail must not be duplicated');

  // Cleanup
  await deleteContract(c1.id);
  await deleteContract(c2.id);
  await deleteContract(c3.id);
  await deleteContract(cBob.id);
});


