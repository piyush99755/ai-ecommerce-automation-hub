import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export interface AdminSessionPayload {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN';
  expiresAt: number;
}

const COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecretKey(): string {
  return process.env.ADMIN_SESSION_SECRET || 'ai-ecommerce-hub-admin-secret-key-32chars-minimum!';
}

/**
 * Hashes a plaintext password using Node native PBKDF2-HMAC-SHA512 with a random 16-byte salt.
 * Used in Node.js server routes & CLI scripts.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored salt:hash pair in constant time.
 * Used in Node.js server routes.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) {
    return false;
  }

  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  
  const bufferA = Buffer.from(hash, 'hex');
  const bufferB = Buffer.from(originalHash, 'hex');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Computes Web Crypto HMAC-SHA256 signature compatible with both Edge Runtime and Node.js.
 */
async function computeWebHmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Creates an HMAC-SHA256 signed session token.
 */
export async function createAdminSessionToken(admin: { id: string; email: string; name: string; role: 'ADMIN' }): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload: AdminSessionPayload = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    expiresAt,
  };

  const json = JSON.stringify(payload);
  const payloadBase64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = await computeWebHmac(payloadBase64, getSecretKey());

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and parses an HMAC-SHA256 signed session token (Edge & Node compatible).
 */
export async function verifyAdminSessionToken(token: string | undefined | null): Promise<AdminSessionPayload | null> {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = await computeWebHmac(payloadBase64, getSecretKey());

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as AdminSessionPayload;

    if (!payload.expiresAt || Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieves current authenticated admin session from cookies in Server Components or API handlers.
 */
export async function getAuthenticatedAdminServer(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export { COOKIE_NAME };
