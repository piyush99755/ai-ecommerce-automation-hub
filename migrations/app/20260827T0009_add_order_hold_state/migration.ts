#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/63f66fddb2301bcc26356ef5c1cdcb59707f93815118eb94745ebfd6e755024f/contract';
import startContract from '../../snapshots/63f66fddb2301bcc26356ef5c1cdcb59707f93815118eb94745ebfd6e755024f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e5c26d17d80537a39d87d1e9e82e0873ec3dee4dd1b6f4d131b8545de52718fb/contract';
import endContract from '../../snapshots/e5c26d17d80537a39d87d1e9e82e0873ec3dee4dd1b6f4d131b8545de52718fb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'order',
        constraint: 'order_status_check_d570e490',
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('statusReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'order',
        constraint: 'order_status_check_50337988',
        expression:
          "\"status\" IN ('PENDING', 'PROCESSING', 'ON_HOLD', 'SHIPPED', 'DELIVERED', 'CANCELLED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
