import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      name: session.name,
      photoUrl: session.photoUrl,
    },
  });
}
