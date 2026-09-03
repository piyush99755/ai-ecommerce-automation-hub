#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/69952d2523cc86e0ea99463895c9f6ddd46d3978917bd3592c8ec566d7f0ccac/contract';
import endContract from '../../snapshots/69952d2523cc86e0ea99463895c9f6ddd46d3978917bd3592c8ec566d7f0ccac/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ca164d2cc336399bccb3f9707964a83b7d1153daab64f26fc562a8867366a9a2/contract';
import startContract from '../../snapshots/ca164d2cc336399bccb3f9707964a83b7d1153daab64f26fc562a8867366a9a2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'copilotAction',
        columns: [
          col('actionType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('adminId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PROPOSED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'copilotAction',
        index: 'copilotAction_adminId_createdAt_idx_5015ed56',
        columns: ['adminId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'copilotAction',
        index: 'copilotAction_adminId_idx_530179db',
        columns: ['adminId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'copilotAction',
        index: 'copilotAction_status_expiresAt_idx_c206f415',
        columns: ['status', 'expiresAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'copilotAction',
        foreignKey: {
          name: 'copilotAction_adminId_fkey',
          columns: ['adminId'],
          references: { schema: 'public', table: 'admin', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
