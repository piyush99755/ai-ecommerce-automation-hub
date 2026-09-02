import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear canonical session cookie (path: '/')
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  // Clear legacy session cookie (path: '/admin') during migration period
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
