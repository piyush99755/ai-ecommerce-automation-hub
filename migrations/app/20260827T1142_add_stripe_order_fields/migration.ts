#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/077916de984ad2bc19ee159ad749fff452d1a3d7419f990f7e75396fb8073b5b/contract';
import endContract from '../../snapshots/077916de984ad2bc19ee159ad749fff452d1a3d7419f990f7e75396fb8073b5b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e5c26d17d80537a39d87d1e9e82e0873ec3dee4dd1b6f4d131b8545de52718fb/contract';
import startContract from '../../snapshots/e5c26d17d80537a39d87d1e9e82e0873ec3dee4dd1b6f4d131b8545de52718fb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('stripeCheckoutSessionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('stripePaymentIntentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'order',
        constraint: 'order_stripeCheckoutSessionId_key',
        columns: ['stripeCheckoutSessionId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
