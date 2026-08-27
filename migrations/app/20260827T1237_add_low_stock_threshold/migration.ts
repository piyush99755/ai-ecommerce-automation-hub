#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/44ceb234b7ac03a0259b85813c21706b25e1c1e52f565db8dd97066e01f4b63a/contract';
import endContract from '../../snapshots/44ceb234b7ac03a0259b85813c21706b25e1c1e52f565db8dd97066e01f4b63a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dfbcc8b3a78048e4429a6698c6061f789ed8e84b58482b77f839ed868211b514/contract';
import startContract from '../../snapshots/dfbcc8b3a78048e4429a6698c6061f789ed8e84b58482b77f839ed868211b514/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('lowStockThreshold', 'int4', {
          notNull: true,
          default: lit(5),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
