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
