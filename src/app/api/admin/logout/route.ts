import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear HTTP-only session cookie
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
