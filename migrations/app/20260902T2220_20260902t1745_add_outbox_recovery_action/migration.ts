#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/206905e651dc2c0b1eff7cac86eb29026891d71ad5a1eb15ca6165671e213edd/contract';
import endContract from '../../snapshots/206905e651dc2c0b1eff7cac86eb29026891d71ad5a1eb15ca6165671e213edd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e5c24df0faa8ff85d4d008dcd535d6192bb610a0ef14542e7315f525d0d67d89/contract';
import startContract from '../../snapshots/e5c24df0faa8ff85d4d008dcd535d6192bb610a0ef14542e7315f525d0d67d89/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'outboxRecoveryAction',
        columns: [
          col('action', 'text', {
            notNull: true,
            default: lit('REQUEUE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('adminId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('outboxEventId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('previousAttemptCount', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('previousStatus', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxRecoveryAction',
        index: 'outboxRecoveryAction_adminId_createdAt_idx_5015ed56',
        columns: ['adminId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxRecoveryAction',
        index: 'outboxRecoveryAction_adminId_idx_530179db',
        columns: ['adminId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxRecoveryAction',
        index: 'outboxRecoveryAction_outboxEventId_createdAt_idx_eaa78c8f',
        columns: ['outboxEventId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxRecoveryAction',
        index: 'outboxRecoveryAction_outboxEventId_idx_df48a7bd',
        columns: ['outboxEventId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'outboxRecoveryAction',
        foreignKey: {
          name: 'outboxRecoveryAction_outboxEventId_fkey',
          columns: ['outboxEventId'],
          references: { schema: 'public', table: 'outboxEvent', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'outboxRecoveryAction',
        foreignKey: {
          name: 'outboxRecoveryAction_adminId_fkey',
          columns: ['adminId'],
          references: { schema: 'public', table: 'admin', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
