import { NextResponse } from 'next/server';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { proposeCopilotAction } from '@/lib/copilot/actions';

export async function POST(request: Request) {
  try {
    const auth = await authorizeAdminCapability('USE_AI_COPILOT');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { admin } = auth;
    const body = await request.json();
    const { userMessage } = body || {};

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: userMessage parameter is required.' },
        { status: 422 }
      );
    }

    const proposalResult = await proposeCopilotAction({
      userMessage,
      adminId: admin.id,
      adminRole: admin.role,
    });

    return NextResponse.json({ ok: true, proposalResult }, { status: 200 });
  } catch (err) {
    console.error('[Admin Copilot Propose API Error]', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred creating action proposal.' },
      { status: 500 }
    );
  }
}
