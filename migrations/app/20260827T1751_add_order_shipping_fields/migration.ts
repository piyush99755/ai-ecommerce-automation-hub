#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/126a25cdbf222f3072177c99f271d258b71d5442c504bb6e4b3ed19ecac3dbd2/contract';
import endContract from '../../snapshots/126a25cdbf222f3072177c99f271d258b71d5442c504bb6e4b3ed19ecac3dbd2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/44ceb234b7ac03a0259b85813c21706b25e1c1e52f565db8dd97066e01f4b63a/contract';
import startContract from '../../snapshots/44ceb234b7ac03a0259b85813c21706b25e1c1e52f565db8dd97066e01f4b63a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('carrier', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('deliveredAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('shippedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('trackingNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
