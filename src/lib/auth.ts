import { NextResponse } from 'next/server';

export function authenticateAutomationSecret(request: Request): NextResponse | null {
  const expectedSecret = process.env.N8N_AUTOMATION_SECRET;

  if (!expectedSecret || expectedSecret.trim() === '') {
    console.warn('[auth] N8N_AUTOMATION_SECRET is missing or unconfigured on the server.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('x-automation-secret');
  if (!authHeader || authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
