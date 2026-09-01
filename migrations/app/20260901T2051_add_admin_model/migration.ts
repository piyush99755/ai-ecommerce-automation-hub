#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/30341f0cb4165fe7ed1e7629c68a3d16f924e069243e56da2d4f6a34ba9abaa7/contract';
import endContract from '../../snapshots/30341f0cb4165fe7ed1e7629c68a3d16f924e069243e56da2d4f6a34ba9abaa7/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'admin',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('ADMIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('admin_role_check_d64e1afa', '"role" IN (\'ADMIN\')'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'consumerEvent',
        columns: [
          col('attemptCount', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('claimedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('consumerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('eventId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PROCESSING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'customer',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'order',
        columns: [
          col('carrier', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('paymentStatus', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('shippedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('statusReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('stripeCheckoutSessionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('stripePaymentIntentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('subtotalCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('totalCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('trackingNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'order_paymentStatus_check_60515b20',
            "\"paymentStatus\" IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')",
          ),
          checkExpression(
            'order_status_check_50337988',
            "\"status\" IN ('PENDING', 'PROCESSING', 'ON_HOLD', 'SHIPPED', 'DELIVERED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'orderItem',
        columns: [
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('orderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('unitPriceCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'outboxEvent',
        columns: [
          col('aggregateId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('aggregateType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('attemptCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('lastAttemptAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('nextAttemptAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'outboxEvent_status_check_2a27bec6',
            "\"status\" IN ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'product',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lowStockThreshold', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('priceCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stock', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'stripeEvent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'admin',
        constraint: 'admin_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'consumerEvent',
        constraint: 'consumerEvent_consumerId_eventId_key',
        columns: ['consumerId', 'eventId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customer',
        constraint: 'customer_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'order',
        constraint: 'order_stripeCheckoutSessionId_key',
        columns: ['stripeCheckoutSessionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'product',
        constraint: 'product_slug_key',
        columns: ['slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'consumerEvent',
        index: 'consumerEvent_status_claimedAt_idx_4fabb826',
        columns: ['status', 'claimedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderItem',
        index: 'orderItem_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderItem',
        index: 'orderItem_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_aggregateType_aggregateId_idx_816576d9',
        columns: ['aggregateType', 'aggregateId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_status_nextAttemptAt_idx_8ba20615',
        columns: ['status', 'nextAttemptAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'product',
        index: 'product_category_idx_f2600f8e',
        columns: ['category'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'customer', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderItem',
        foreignKey: {
          name: 'orderItem_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderItem',
        foreignKey: {
          name: 'orderItem_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
