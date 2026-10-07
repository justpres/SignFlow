export function isGlobalAdmin(email?: string | null): boolean {
  if (!email) return false;
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@signflow.app').trim().toLowerCase();
  return email.trim().toLowerCase() === adminEmail;
}

export function isContractOwner(
  session: { userId?: string; email: string },
  contract: { userId?: string; ownerEmail?: string }
): boolean {
  if (isGlobalAdmin(session.email)) return true;
  if (contract.userId && session.userId && contract.userId === session.userId) return true;
  if (contract.ownerEmail && contract.ownerEmail.toLowerCase() === session.email.toLowerCase()) return true;
  return false;
}

export function isTemplateOwner(
  session: { userId?: string; email: string },
  template: { userId?: string; ownerEmail?: string }
): boolean {
  if (isGlobalAdmin(session.email)) return true;
  if (template.userId && session.userId && template.userId === session.userId) return true;
  if (template.ownerEmail && template.ownerEmail.toLowerCase() === session.email.toLowerCase()) return true;
  return false;
}
