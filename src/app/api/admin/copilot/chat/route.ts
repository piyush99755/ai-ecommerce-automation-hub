import { NextResponse } from 'next/server';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { determineCopilotIntent, executeCopilotTool } from '@/lib/copilot/tools';
import { generateAdminCopilotResponse, ChatMessageInput } from '@/lib/ai/provider';

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Central Server Authentication & Fresh Role Authorization for USE_AI_COPILOT
    const auth = await authorizeAdminCapability('USE_AI_COPILOT');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { admin } = auth;
    const body = await request.json();
    const { messages } = body || {};

    // 2. Input Validation & Request Bounds
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: At least one chat message is required.' },
        { status: 422 }
      );
    }

    const boundedMessages: ChatMessageInput[] = messages.slice(-10).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content.slice(0, 500) : '',
    }));

    const lastUserMessage = [...boundedMessages].reverse().find((m) => m.role === 'user')?.content || '';
    if (!lastUserMessage || lastUserMessage.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: User message content cannot be empty.' },
        { status: 422 }
      );
    }

    // 3. Deterministic Intent Routing
    const intent = determineCopilotIntent(lastUserMessage);

    // 4. Per-Tool RBAC Authorization & Safe Execution (Authorization BEFORE query)
    const toolResult = await executeCopilotTool(intent.toolName, intent.params, admin.role);

    // 5. Invoke AI Provider Abstraction with Bounded Context
    const aiResponse = await generateAdminCopilotResponse({
      messages: boundedMessages,
      toolResult,
      adminRole: admin.role,
    });

    const durationMs = Date.now() - startTime;

    // Safe Development Observability (NO AdminAuditLog flood for read operations, NO secrets logged)
    console.log(
      `[Admin Copilot API] Handled query in ${durationMs}ms | Admin: ${admin.email} (${admin.role}) | Intent: ${intent.toolName} | ToolAuthorized: ${toolResult.authorized} | Provider: ${aiResponse.providerUsed}`
    );

    return NextResponse.json(
      {
        ok: true,
        message: aiResponse.message,
        sourceBadges: aiResponse.sourceBadges,
        providerUsed: aiResponse.providerUsed,
        executedTool: intent.toolName,
        toolAuthorized: toolResult.authorized,
        adminRole: admin.role,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[Admin Copilot API Error]', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred while generating copilot response.' },
      { status: 500 }
    );
  }
}
