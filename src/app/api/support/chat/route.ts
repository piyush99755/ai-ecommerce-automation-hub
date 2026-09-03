import { NextResponse } from 'next/server';
import {
  searchProducts,
  retrieveSupportKnowledge,
  getAuthorizedOrderSummary,
  SafeProductResult,
  SupportKnowledgeResult,
  SafeOrderSummary,
} from '@/lib/support/tools';
import { generateSupportResponse, ChatMessageInput } from '@/lib/ai/provider';

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { messages, orderId, sessionId } = body || {};

    // 1. Input Validation & Request Bounds
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: At least one chat message is required.' },
        { status: 422 }
      );
    }

    // Limit conversation history depth to max 10 messages
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

    // 2. Server-Side Tool Execution & Grounded Context Retrieval
    const [products, policyDocs] = await Promise.all([
      searchProducts(lastUserMessage),
      retrieveSupportKnowledge(lastUserMessage),
    ]);

    let orderSummary: SafeOrderSummary | null = null;
    let orderAccessDenied: string | null = null;

    // Order lookup triggers ONLY if orderId is provided
    if (orderId && typeof orderId === 'string' && orderId.trim().length > 0) {
      const orderResult = await getAuthorizedOrderSummary(orderId, sessionId);
      if (orderResult.authorized) {
        orderSummary = orderResult.summary;
      } else {
        orderAccessDenied = orderResult.error;
      }
    }

    // 3. Invoke AI Provider Abstraction with Bounded Context
    const aiResponse = await generateSupportResponse({
      messages: boundedMessages,
      context: {
        products,
        policyDocs,
        orderSummary,
        orderAccessDenied,
      },
    });

    const durationMs = Date.now() - startTime;

    // Safe Development Observability (NO secrets, keys, or full customer tokens logged)
    console.log(
      `[AI Support API] Handled chat query in ${durationMs}ms | Provider: ${aiResponse.providerUsed} | Products: ${products.length} | PolicyDocs: ${policyDocs.length} | OrderAuthorized: ${Boolean(orderSummary)}`
    );

    return NextResponse.json(
      {
        ok: true,
        message: aiResponse.message,
        sourceBadges: aiResponse.sourceBadges,
        providerUsed: aiResponse.providerUsed,
        retrievedContextSummary: {
          productCount: products.length,
          policyDocCount: policyDocs.length,
          orderAuthorized: Boolean(orderSummary),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[AI Support API Error]', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred while generating support response.' },
      { status: 500 }
    );
  }
}
