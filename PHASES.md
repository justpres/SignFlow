# SignFlow PH: Implementation Roadmap & Execution Checklist

> **Mission**: Eliminate the real-world friction of contract signing in the Philippines (computer shop "print-sign-scan" burden, "valid ba 'to kung hindi notarized?" legal anxiety, ignored email inboxes, and lack of trust verification) without building bloated, complex software.

---

## Operating Protocol for Agents
Before implementing any task:
1. **Check Current State**: Verify existing codebase files, types, and test suites.
2. **Review Checklist**: Locate the active phase, sub-phase, and specific task in this document (`PHASES.md`).
3. **Implement Feature**: Write clean, test-backed, minimal code focused on eliminating user friction.
4. **Run Verification**: Execute `npm test` and build checks.
5. **Update Checklist**: Mark completed items with `[x]` and document any non-obvious details.

---

## Phase 1: Philippine Legal Validity & Signer Identity
**Core Objective**: Eliminate legal doubt (*"Valid ba 'to kung hindi notarized?"*) and identity fraud fears (*"Kailangan ng valid ID with 3 specimen signatures"*).

### Sub-phase 1.1: Legal & Statutory Compliance Grounding (RA 8792)
- [x] **1.1.1 Statutory Certificate Citation**: Update `lib/pdf/certificate.ts` to explicitly cite **Republic Act No. 8792 (Philippine Electronic Commerce Act of 2000)** and **Supreme Court A.M. No. 01-7-01-SC (Rules on Electronic Evidence)** alongside global standards (ESIGN / UETA).
- [x] **1.1.2 Signer Legal Disclosure Update**: Update the legal disclosure modal in `components/signing/SigningFlow.tsx` and confirmation text explaining the statutory validity of electronic contracts under Philippine Law.
- [x] **1.1.3 Client Trust Badge**: Add a clean, reassuring trust badge on `/sign/[token]` (e.g. *"Legally Recognized in the Philippines • RA 8792"* with 256-bit cryptographic seal).

### Sub-phase 1.2: Philippine Government ID & Identity Verification
- [x] **1.2.1 Data Model Extension**: Extend `lib/types/index.ts` and `Contract` schema with `requiresGovId?: boolean`, `govIdType?: string`, and `govIdPhotoBase64?: string` / `govIdPhotoPath?: string`.
- [x] **1.2.2 Admin Creation Toggle**: Add an optional toggle in `/admin/contracts/new` and `AdminFieldPreparationModal.tsx`: *"Require Philippine Government ID (PhilSys National ID, Driver's License, UMID, Passport, TIN, PRC)"*.
- [x] **1.2.3 Mobile ID Camera Capture**: Add a mobile-friendly camera capture / photo upload component in `/sign/[token]` for signers to attach their ID with client-side image compression.
- [x] **1.2.4 Watermarked ID Embedding**: Embed a watermarked, secure ID thumbnail on the Certificate of Completion in `lib/pdf/certificate.ts` when provided.

### Sub-phase 1.3: Verification & Test Suite
- [x] **1.3.1 Certificate RA 8792 Tests**: Update `tests/certificate.test.mjs` to assert RA 8792 text and layout stability.
- [x] **1.3.2 Gov ID Flow Verification**: Add unit/integration test in `tests/` verifying contract finalization with and without government ID attachments.

---

## Phase 2: Philippine Delivery Channels & Smart Sharing
**Core Objective**: Eliminate the unread email delay and awkward manual follow-ups by meeting Filipino users where they actually communicate (Viber, Messenger, WhatsApp).

### Sub-phase 2.1: Instant Shareable Link & Chat Templates
- [ ] **2.1.1 Share Link Action Bar**: Add 1-click **"Copy Link"**, **"Share via Viber"**, and **"Share via WhatsApp"** buttons on `/admin/contracts/[id]` and the contracts table.
- [ ] **2.1.2 Pre-composed Chat Messages**: Provide 1-click copyable message templates tailored for Filipino clients (English & Taglish options):
  - *Example: "Hi [Client], here is the official agreement '[Title]' ready for your signature: [Link]. It only takes 1 minute on your phone."*
- [ ] **2.1.3 Social Preview Metadata**: Add OpenGraph & Twitter Card tags on `/sign/[token]` so sharing links on Viber, Messenger, or Telegram renders a secure, professional branded preview card rather than a bare URL.

### Sub-phase 2.2: Live Signer Activity & Polite Nudges
- [ ] **2.2.1 Opened on Mobile Telemetry**: Display a clear "Opened by Signer" badge and device telemetry in the admin dashboard when the client accesses the link.
- [ ] **2.2.2 1-Click Reminder Nudge**: Add a "Send Reminder" quick action in admin view that copies a polite reminder snippet to paste into chat.

### Sub-phase 2.3: Verification & Test Suite
- [ ] **2.3.1 Sharing Link & Telemetry Tests**: Add test coverage for signing token URL resolution and audit logging of chat-opened events.

---

## Phase 3: Frictionless Mobile Signing Experience
**Core Objective**: Eliminate the "Print-Sign-Scan" computer shop hassle with an ultra-fast, data-light mobile signing experience on any Android or iOS device.

### Sub-phase 3.1: Thumb-Friendly Mobile Viewport & Direct Sign Drawer
- [ ] **3.1.1 Fast Mobile Canvas Optimization**: Refine touch smoothing, palm rejection, and zero-delay touch response (`touch-action: none`) on budget mobile touchscreens.
- [ ] **3.1.2 Floating "Jump to Sign" Action**: Add a floating sticky button on mobile PDF viewer allowing signers to instantly jump to their signature location in multi-page documents without getting lost.
- [ ] **3.1.3 Non-Intrusive Bottom Drawer**: Replace cramped signature popups on mobile with a clean, full-width bottom drawer that never obscures the screen or suffers from zoom jump.

### Sub-phase 3.2: Instant Post-Sign Copy Delivery
- [ ] **3.2.1 Immediate Download & Inbox Delivery**: Ensure the signed, cryptographically sealed PDF is delivered immediately to the signer's screen and email upon finalization without requiring an account.
- [ ] **3.2.2 Mobile Success Receipt**: Provide a clean, shareable confirmation card with reference ID, timestamp, and verification link.

### Sub-phase 3.3: Verification & Test Suite
- [ ] **3.3.1 Mobile Responsiveness & Rendering Tests**: Run end-to-end mobile viewport and performance benchmarks.
- [ ] **3.3.2 Full Regression Suite**: Run `npm test` and `npm run build` with zero regressions across the whole platform.

---

## Current Status Summary
- **Phase 1**: Completed (Sub-phases 1.1, 1.2, and 1.3 fully implemented and verified: RA 8792 statutory compliance, Philippine Government ID verification, watermarked specimen embedding, and test suites)
- **Phase 2**: Pending implementation
- **Phase 3**: Pending implementation
