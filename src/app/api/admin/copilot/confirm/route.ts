import { NextResponse } from 'next/server';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { confirmAndExecuteCopilotAction } from '@/lib/copilot/actions';

export async function POST(request: Request) {
  try {
    const auth = await authorizeAdminCapability('USE_AI_COPILOT');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { admin } = auth;
    const body = await request.json();
    const { actionId } = body || {};

    if (!actionId || typeof actionId !== 'string' || actionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: actionId parameter is required.' },
        { status: 422 }
      );
    }

    const executionResult = await confirmAndExecuteCopilotAction({
      actionId: actionId.trim(),
      adminId: admin.id,
    });

    if (!executionResult.success) {
      const status =
        executionResult.code === 'FORBIDDEN'
          ? 403
          : executionResult.code === 'EXPIRED'
          ? 400
          : executionResult.code === 'ALREADY_EXECUTED' || executionResult.code === 'CONFLICT'
          ? 409
          : executionResult.code === 'NOT_FOUND'
          ? 404
          : 422;

      return NextResponse.json(
        { ok: false, error: executionResult.error, code: executionResult.code },
        { status }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Action confirmed and executed successfully through backend business service.',
        executionResult,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[Admin Copilot Confirm API Error]', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred confirming action proposal.' },
      { status: 500 }
    );
  }
}
