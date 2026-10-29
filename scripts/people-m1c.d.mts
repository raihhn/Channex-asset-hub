import type { PoolClient } from "pg";
import type { Person } from "../src/types/identity";
import type { PeopleRepository } from "../src/server/people/repository";
export const migration: string;
export function assertTarget(url: string, expectedDatabase: string): string;
export function operatorModules(): Promise<{
  PeopleRepository: typeof PeopleRepository;
  peopleFixtures: Person[];
}>;
export function executeM1c(
  client: PoolClient,
  bundle: string,
  command: "apply" | "import-people",
  modules: {
    PeopleRepository: typeof PeopleRepository;
    peopleFixtures: readonly Person[];
  },
): Promise<{
  migration: string;
  checksum: string;
  command: string;
  inserted: string[];
  skipped: string[];
  sourceSha256: string;
  businessTablesPreserved: boolean;
  historicalProvenancePreserved: boolean;
}>;
