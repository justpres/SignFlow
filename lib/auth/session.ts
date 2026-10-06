import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'signflow_admin_session';

export async function createAdminSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = Buffer.from(JSON.stringify({ email, authenticatedAt: Date.now() })).toString('base64');
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function getAdminSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;

  try {
    const raw = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const data = JSON.parse(raw);
    if (data.email) {
      return { email: data.email };
    }
    return null;
  } catch {
    return null;
  }
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
