import { createAvatar } from '@dicebear/core';
import { notionists, initials } from '@dicebear/collection';

/**
 * Generate a deterministic DiceBear avatar Data URI from a user seed (name, email, or id).
 * Defaults to 'notionists' (monochrome illustrated portrait) or 'initials' (monochrome badge).
 */
export function getDiceBearAvatar(
  seed: string,
  style: 'notionists' | 'initials' = 'notionists'
): string {
  const cleanSeed = (seed || 'SignFlow').trim();
  try {
    if (style === 'notionists') {
      const avatar = createAvatar(notionists, {
        seed: cleanSeed,
      });
      return avatar.toDataUri();
    }

    const avatar = createAvatar(initials, {
      seed: cleanSeed,
      backgroundColor: ['000000'],
      textColor: ['ffffff'],
      fontSize: 46,
      chars: 2,
    });
    return avatar.toDataUri();
  } catch (err) {
    console.warn('Failed to generate DiceBear avatar:', err);
    // Safe SVG fallback
    const initialChar = (cleanSeed.charAt(0) || 'U').toUpperCase();
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23000000"/><text x="50" y="55" font-family="sans-serif" font-size="44" font-weight="bold" fill="%23ffffff" text-anchor="middle" dominant-baseline="middle">${initialChar}</text></svg>`;
  }
}
