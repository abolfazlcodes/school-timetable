import { eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { schools } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";

export interface SchoolProfile {
  id: string;
  name: string;
  code: string | null;
  province: string | null;
  city: string | null;
  phone: string | null;
}

export interface SchoolProfileChanges {
  name: string;
  code: string | null;
  province: string | null;
  city: string | null;
  phone: string | null;
}

export interface SchoolRepository {
  getProfile(context: TenantContext): Promise<SchoolProfile | null>;
  updateProfile(context: TenantContext, changes: SchoolProfileChanges, now: Date): Promise<SchoolProfile | null>;
}

export function createSchoolRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): SchoolRepository {
  const fields = { id: schools.id, name: schools.name, code: schools.code, province: schools.province, city: schools.city, phone: schools.phone };
  return {
    async getProfile(context) {
      const [school] = await db.select(fields).from(schools).where(eq(schools.id, context.schoolId)).limit(1);
      return school ?? null;
    },
    async updateProfile(context, changes, now) {
      const [school] = await db.update(schools).set({ ...changes, updatedAt: now })
        .where(eq(schools.id, context.schoolId)).returning(fields);
      return school ?? null;
    },
  };
}
