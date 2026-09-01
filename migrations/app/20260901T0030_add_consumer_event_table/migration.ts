#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7a770258fd4c1da099a8300a0a6c7d011ebba9455528e7e411fc1a3391a7eb50/contract';
import endContract from '../../snapshots/7a770258fd4c1da099a8300a0a6c7d011ebba9455528e7e411fc1a3391a7eb50/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fb34a8140225f72fdfab1604eef03db3373209219ce88609e0d1b1004d9dc89c/contract';
import startContract from '../../snapshots/fb34a8140225f72fdfab1604eef03db3373209219ce88609e0d1b1004d9dc89c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
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
      this.addUnique({
        schema: 'public',
        table: 'consumerEvent',
        constraint: 'consumerEvent_consumerId_eventId_key',
        columns: ['consumerId', 'eventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'consumerEvent',
        index: 'consumerEvent_status_claimedAt_idx_4fabb826',
        columns: ['status', 'claimedAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
