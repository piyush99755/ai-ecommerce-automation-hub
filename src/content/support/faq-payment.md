# Payment & Checkout FAQ

Payment Methods & Billing Guidance:
- Accepted Payments: We accept major credit cards (Visa, MasterCard, American Express, Discover) via Stripe Secure Checkout.
- Payment Security: Credit card details are processed directly by Stripe and are never stored on our servers.
- When Payment Charges Occur: Payment is charged immediately at checkout. Once Stripe confirms payment (`paymentStatus: PAID`), fulfillment begins automatically.
- Failed Payments: If payment fails (`paymentStatus: FAILED`), your order remains in PENDING state until resolved or re-attempted.
- Receipt & Invoice: An automated email confirmation and receipt is sent upon payment completion.
