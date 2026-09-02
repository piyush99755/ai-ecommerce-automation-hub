#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/30341f0cb4165fe7ed1e7629c68a3d16f924e069243e56da2d4f6a34ba9abaa7/contract';
import startContract from '../../snapshots/30341f0cb4165fe7ed1e7629c68a3d16f924e069243e56da2d4f6a34ba9abaa7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e5c24df0faa8ff85d4d008dcd535d6192bb610a0ef14542e7315f525d0d67d89/contract';
import endContract from '../../snapshots/e5c24df0faa8ff85d4d008dcd535d6192bb610a0ef14542e7315f525d0d67d89/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'inventoryAdjustment',
        columns: [
          col('adminId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('delta', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('newStock', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('previousStock', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventoryAdjustment',
        index: 'inventoryAdjustment_adminId_createdAt_idx_5015ed56',
        columns: ['adminId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventoryAdjustment',
        index: 'inventoryAdjustment_adminId_idx_530179db',
        columns: ['adminId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventoryAdjustment',
        index: 'inventoryAdjustment_productId_createdAt_idx_58d1a09b',
        columns: ['productId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventoryAdjustment',
        index: 'inventoryAdjustment_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventoryAdjustment',
        foreignKey: {
          name: 'inventoryAdjustment_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventoryAdjustment',
        foreignKey: {
          name: 'inventoryAdjustment_adminId_fkey',
          columns: ['adminId'],
          references: { schema: 'public', table: 'admin', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
