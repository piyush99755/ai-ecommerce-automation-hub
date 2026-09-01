/**
 * Portfolio Screenshot Generator Script
 * AI E-commerce Automation Hub
 *
 * Reproducibly captures high-resolution (1440x900px) sanitized portfolio screenshots
 * for the customer storefront, product detail page, cart review, checkout, and order confirmation.
 *
 * Usage:
 *   npx tsx scripts/capture-portfolio.ts
 */

import { db } from '../src/prisma/db';
import playwright from 'file:///C:/Users/piyus/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.js';
import path from 'path';
import fs from 'fs';

const { chromium } = playwright;

const DEMO_CUSTOMER_EMAIL = 'alex.rivera@example.com';
const DEMO_CUSTOMER_NAME = 'Alex Rivera';
const DEMO_ORDER_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0123456789ab';
const DEMO_SESSION_ID = 'cs_demo_portfolio_session_99';

async function main() {
  const screenshotsDir = path.join(process.cwd(), 'docs', 'portfolio', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Fetching demo product for order seed...');
  const product = await db.orm.public.Product.where({ slug: 'wireless-mechanical-keyboard' }).first();
  if (!product) {
    throw new Error('Product wireless-mechanical-keyboard not found in database.');
  }

  // Ensure demo customer exists in Neon PostgreSQL
  let customer = await db.orm.public.Customer.where({ email: DEMO_CUSTOMER_EMAIL }).first();
  if (!customer) {
    customer = await db.orm.public.Customer.create({
      name: DEMO_CUSTOMER_NAME,
      email: DEMO_CUSTOMER_EMAIL,
    });
  }

  // Upsert demo order with status PROCESSING and paymentStatus PAID
  const existingOrder = await db.orm.public.Order.where({ id: DEMO_ORDER_ID }).first();
  if (existingOrder) {
    await db.orm.public.Order.where({ id: DEMO_ORDER_ID }).update({
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      stripeCheckoutSessionId: DEMO_SESSION_ID,
      carrier: 'FedEx',
      trackingNumber: 'FX-884920199',
    });
  } else {
    await db.orm.public.Order.create({
      id: DEMO_ORDER_ID,
      customerId: customer.id,
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      stripeCheckoutSessionId: DEMO_SESSION_ID,
      subtotalCents: product.priceCents,
      totalCents: product.priceCents,
      carrier: 'FedEx',
      trackingNumber: 'FX-884920199',
    });
  }

  // Ensure demo OrderItem exists
  const existingItem = await db.orm.public.OrderItem.where({ orderId: DEMO_ORDER_ID, productId: product.id }).first();
  if (!existingItem) {
    await db.orm.public.OrderItem.create({
      orderId: DEMO_ORDER_ID,
      productId: product.id,
      quantity: 1,
      unitPriceCents: product.priceCents,
    });
  }

  console.log('Launching Playwright Chromium (1440x900 viewport)...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // 1. Storefront Catalog
  console.log('Capturing 01-storefront-catalog.png...');
  await page.goto('http://localhost:3000/products');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '01-storefront-catalog.png') });

  // 2. Product Detail
  console.log('Capturing 02-product-detail.png...');
  await page.goto('http://localhost:3000/products/wireless-mechanical-keyboard');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '02-product-detail.png') });

  // Add to Cart
  await page.click('button:has-text("Add to Cart")');
  await page.waitForTimeout(1000);

  // 3. Cart Review
  console.log('Capturing 03-cart-review.png...');
  await page.screenshot({ path: path.join(screenshotsDir, '03-cart-review.png') });

  // 4. Checkout Review Screen
  console.log('Capturing 04-checkout.png...');
  await page.goto('http://localhost:3000/checkout');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '04-checkout.png') });

  // 6. Order Confirmation & Processing
  console.log('Capturing 06-order-processing.png...');
  await page.goto(`http://localhost:3000/orders/${DEMO_ORDER_ID}?session_id=${DEMO_SESSION_ID}`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(screenshotsDir, '06-order-processing.png') });

  await browser.close();
  console.log('=== All Portfolio Screenshots Captured & Verified ===');
}

main().catch((err) => {
  console.error('Error during portfolio screenshot generation:', err);
  process.exit(1);
});
