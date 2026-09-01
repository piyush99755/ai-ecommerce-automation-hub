import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSessionToken, COOKIE_NAME } from './lib/admin-auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await verifyAdminSessionToken(token);

  const isLoginPage = pathname === '/admin/login';

  // Unauthenticated user trying to access protected /admin page
  if (!session && !isLoginPage) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to access /admin/login
  if (session && isLoginPage) {
    const dashboardUrl = new URL('/admin/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
