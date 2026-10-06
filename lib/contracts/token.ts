import crypto from 'crypto';

/**
 * Generates an unpredictable cryptographically secure token for client signing URLs.
 * Tokens are 32 bytes (64 hex characters) and never expose database internal IDs.
 */
export function generateSigningToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes the SHA-256 hash of a signing token.
 * Only this hash is stored in Firestore, so a leaked database dump cannot be used
 * to forge client signing links.
 */
export function hashSigningToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
