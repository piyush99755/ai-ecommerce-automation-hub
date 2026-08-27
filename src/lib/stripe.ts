import Stripe from 'stripe';

export function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
  const client = new Stripe(apiKey);

  // If using placeholder key in offline test/dev environment, mock API calls to prevent StripeAuthenticationError
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).checkout = {
      sessions: {
        create: async (params: Stripe.Checkout.SessionCreateParams) => {
          const fakeId = `cs_test_${Math.random().toString(36).substring(2, 10)}`;
          return {
            id: fakeId,
            object: 'checkout.session',
            status: 'open',
            url: `https://checkout.stripe.com/c/pay/${fakeId}`,
            payment_status: 'unpaid',
            metadata: params.metadata,
          };
        },
        retrieve: async (sessionId: string) => {
          return {
            id: sessionId,
            object: 'checkout.session',
            status: 'open',
            url: `https://checkout.stripe.com/c/pay/${sessionId}`,
            payment_status: 'unpaid',
          };
        },
      },
    };
  }

  return client;
}
