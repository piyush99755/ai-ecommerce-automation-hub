import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { verifyPassword, createAdminSessionToken, COOKIE_NAME } from '@/lib/admin-auth';

// Pre-computed dummy PBKDF2 hash to ensure identical CPU execution time for nonexistent emails
const DUMMY_HASH = '00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query admin user by email
    const admin = await db.orm.public.Admin
      .where({ email: normalizedEmail })
      .first();

    // Perform password verification path regardless of whether user exists
    // (Prevents side-channel response time enumeration attacks)
    const targetHash = admin ? admin.passwordHash : DUMMY_HASH;
    const isValid = verifyPassword(password, targetHash);

    if (!admin || !isValid) {
      // Generic error response prevents user enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session token
    const token = await createAdminSessionToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'ADMIN',
    });

    const response = NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });

    // Set HTTP-only session cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/admin',
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch (err: unknown) {
    console.error('[Admin Login Error]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
