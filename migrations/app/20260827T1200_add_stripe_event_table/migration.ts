#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/077916de984ad2bc19ee159ad749fff452d1a3d7419f990f7e75396fb8073b5b/contract';
import startContract from '../../snapshots/077916de984ad2bc19ee159ad749fff452d1a3d7419f990f7e75396fb8073b5b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dfbcc8b3a78048e4429a6698c6061f789ed8e84b58482b77f839ed868211b514/contract';
import endContract from '../../snapshots/dfbcc8b3a78048e4429a6698c6061f789ed8e84b58482b77f839ed868211b514/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
