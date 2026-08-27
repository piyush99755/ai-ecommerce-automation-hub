#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/126a25cdbf222f3072177c99f271d258b71d5442c504bb6e4b3ed19ecac3dbd2/contract';
import startContract from '../../snapshots/126a25cdbf222f3072177c99f271d258b71d5442c504bb6e4b3ed19ecac3dbd2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fb34a8140225f72fdfab1604eef03db3373209219ce88609e0d1b1004d9dc89c/contract';
import endContract from '../../snapshots/fb34a8140225f72fdfab1604eef03db3373209219ce88609e0d1b1004d9dc89c/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
