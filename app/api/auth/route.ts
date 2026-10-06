import { NextResponse } from 'next/server';
import { createAdminSession, destroyAdminSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Admin validation: Check configured admin credentials or default admin development account
    const configuredEmail = process.env.ADMIN_EMAIL || 'admin@signflow.app';
    const configuredPassword = process.env.ADMIN_PASSWORD || 'AdminSignFlow2026!';

    if (email === configuredEmail && password === configuredPassword) {
      await createAdminSession(email);
      return NextResponse.json({ success: true, user: { email } });
    }

    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function DELETE() {
  await destroyAdminSession();
  return NextResponse.json({ success: true });
}
