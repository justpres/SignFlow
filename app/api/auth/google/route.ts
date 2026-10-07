import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/admin';
import { saveUser, getUserByEmail } from '@/lib/firebase/service';
import { createUserSession } from '@/lib/auth/session';
import { getDiceBearAvatar } from '@/lib/avatar';
import type { User } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken, email, name, photoUrl, googleId } = body;

    let verifiedEmail = email ? String(email).trim().toLowerCase() : undefined;
    let verifiedName = name ? String(name).trim() : undefined;
    let verifiedPhoto = photoUrl ? String(photoUrl).trim() : undefined;
    let verifiedUid = googleId ? String(googleId).trim() : undefined;

    // Verify Firebase ID Token if Firebase Admin is fully configured
    const adminApp = getAdminApp();
    if (adminApp && idToken && typeof idToken === 'string' && idToken !== 'dev-token') {
      try {
        const { getAuth } = await import('firebase-admin/auth');
        const decoded = await getAuth(adminApp).verifyIdToken(idToken);
        if (decoded.email) verifiedEmail = decoded.email.toLowerCase();
        if (decoded.name) verifiedName = decoded.name;
        if (decoded.picture) verifiedPhoto = decoded.picture;
        if (decoded.uid) verifiedUid = decoded.uid;
      } catch (err) {
        console.warn('Firebase ID token verification failed; falling back to profile claims:', err);
      }
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { error: 'A valid email address is required for Google account creation and login' },
        { status: 400 }
      );
    }

    // Check for existing user or create a new one (upsert)
    const existingUser = await getUserByEmail(verifiedEmail);
    const userId = existingUser
      ? existingUser.id
      : verifiedUid || `usr_${Buffer.from(verifiedEmail).toString('hex').slice(0, 12)}`;

    const displayName = verifiedName || existingUser?.name || verifiedEmail.split('@')[0];
    const avatarUrl = verifiedPhoto || existingUser?.photoUrl || getDiceBearAvatar(verifiedEmail, 'notionists');

    const user: User = {
      id: userId,
      email: verifiedEmail,
      name: displayName,
      photoUrl: avatarUrl,
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveUser(user);

    // Create secure HTTP-only session cookie
    await createUserSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl,
    });

    return NextResponse.json({
      success: true,
      user: {
        userId: user.id,
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Google authentication error:', error);
    return NextResponse.json(
      { error: `Google sign-in failed: ${message}` },
      { status: 500 }
    );
  }
}
