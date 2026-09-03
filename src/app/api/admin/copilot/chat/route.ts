import { NextResponse } from 'next/server';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { determineCopilotIntent, executeCopilotTool } from '@/lib/copilot/tools';
import { proposeCopilotAction } from '@/lib/copilot/actions';
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

    // 3. Mutation Action Proposal Check (Human-in-the-Loop Safeguard)
    const actionProposal = await proposeCopilotAction({
      userMessage: lastUserMessage,
      adminId: admin.id,
      adminRole: admin.role,
    });

    if (actionProposal.isMutationIntent) {
      if (!actionProposal.authorized) {
        return NextResponse.json(
          {
            ok: true,
            message: `🔒 **Access Denied**: ${actionProposal.error}`,
            sourceBadges: ['RBAC Authorization Denied'],
            providerUsed: 'Deterministic Copilot Safeguard',
            adminRole: admin.role,
          },
          { status: 200 }
        );
      }

      if (!actionProposal.proposed) {
        return NextResponse.json(
          {
            ok: true,
            message: `⚠️ **Action Proposal Blocked**: ${actionProposal.error}`,
            sourceBadges: ['Validation Safeguard'],
            providerUsed: 'Deterministic Copilot Safeguard',
            adminRole: admin.role,
          },
          { status: 200 }
        );
      }

      const card = actionProposal.proposalCard;
      const explanation =
        card?.actionType === 'ADJUST_INVENTORY'
          ? `📝 **Proposed Inventory Adjustment**: I have created a pending action proposal to adjust stock for **${card.details['productName']}** by **${card.details['proposedChange']}** (Expected Stock: ${card.details['expectedStock']}).\n\nPlease review the proposal card below and click **Confirm Adjustment** to execute this change.`
          : `📝 **Proposed Event Requeue**: I have created a pending action proposal to requeue failed event **${card?.details['eventType']}** (ID: ${card?.details['eventId']}).\n\nPlease review the proposal card below and click **Confirm Event Requeue** to execute this recovery.`;

      return NextResponse.json(
        {
          ok: true,
          message: explanation,
          proposalCard: card,
          sourceBadges: ['Action Proposed (Awaiting Admin Confirmation)'],
          providerUsed: 'Deterministic Action Proposal Engine',
          adminRole: admin.role,
        },
        { status: 200 }
      );
    }

    // 4. Deterministic Intent Routing for Read Operations
    const intent = determineCopilotIntent(lastUserMessage);
    const toolResult = await executeCopilotTool(intent.toolName, intent.params, admin.role);

    // 5. Invoke AI Provider Abstraction
    const aiResponse = await generateAdminCopilotResponse({
      messages: boundedMessages,
      toolResult,
      adminRole: admin.role,
    });

    const durationMs = Date.now() - startTime;
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
