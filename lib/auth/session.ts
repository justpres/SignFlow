import { cookies } from 'next/headers';
import type { UserSession } from '../types/index';

const SESSION_COOKIE_NAME = 'signflow_admin_session';

export async function createUserSession(user: {
  userId: string;
  email: string;
  name?: string;
  photoUrl?: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const sessionData: UserSession = {
    userId: user.userId,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    photoUrl: user.photoUrl,
    authenticatedAt: Date.now(),
  };
  const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function createAdminSession(email: string): Promise<void> {
  const sanitizedId = 'usr_admin_' + Buffer.from(email).toString('hex').slice(0, 10);
  await createUserSession({
    userId: sanitizedId,
    email,
    name: 'SignFlow Administrator',
  });
}

export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;

  try {
    const raw = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const data = JSON.parse(raw);
    if (!data.email) return null;
    return {
      userId: data.userId || ('usr_' + Buffer.from(data.email).toString('hex').slice(0, 10)),
      email: data.email,
      name: data.name || data.email.split('@')[0],
      photoUrl: data.photoUrl,
      authenticatedAt: data.authenticatedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<UserSession | null> {
  return getUserSession();
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function destroyUserSession(): Promise<void> {
  return destroyAdminSession();
}
