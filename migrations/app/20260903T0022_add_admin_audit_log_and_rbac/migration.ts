#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/206905e651dc2c0b1eff7cac86eb29026891d71ad5a1eb15ca6165671e213edd/contract';
import startContract from '../../snapshots/206905e651dc2c0b1eff7cac86eb29026891d71ad5a1eb15ca6165671e213edd/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ca164d2cc336399bccb3f9707964a83b7d1153daab64f26fc562a8867366a9a2/contract';
import endContract from '../../snapshots/ca164d2cc336399bccb3f9707964a83b7d1153daab64f26fc562a8867366a9a2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'admin',
        constraint: 'admin_role_check_d64e1afa',
      }),
      this.createTable({
        schema: 'public',
        table: 'adminAuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('adminId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.setDefault({
        schema: 'public',
        table: 'admin',
        column: 'role',
        defaultSql: "DEFAULT 'SUPER_ADMIN'",
        operationClass: 'widening',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'admin',
        constraint: 'admin_role_check_a968123a',
        expression: "\"role\" IN ('SUPER_ADMIN', 'OPERATIONS', 'SUPPORT')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_action_createdAt_idx_a6d20b4b',
        columns: ['action', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_adminId_createdAt_idx_5015ed56',
        columns: ['adminId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_adminId_idx_530179db',
        columns: ['adminId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_entityType_entityId_createdAt_idx_e9eb579f',
        columns: ['entityType', 'entityId', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'adminAuditLog',
        foreignKey: {
          name: 'adminAuditLog_adminId_fkey',
          columns: ['adminId'],
          references: { schema: 'public', table: 'admin', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
