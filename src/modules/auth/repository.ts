import { and, eq, gt, isNull } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import * as schema from "@/db/schema";
import { schoolMemberships, schools, sessions, users, type SchoolRole } from "@/db/schema";
import type { TenantContext } from "@/modules/tenancy/types";

export interface SchoolMembershipView {
  schoolId: string;
  schoolName: string;
  schoolCode: string | null;
  role: SchoolRole;
}

export interface LoginIdentity {
  userId: string;
  fullName: string;
  passwordHash: string;
  memberships: SchoolMembershipView[];
}

export interface AuthRepository {
  findLoginIdentity(email: string): Promise<LoginIdentity | null>;
  createSession(input: { id: string; tokenHash: string; userId: string; activeSchoolId: string; expiresAt: Date; now: Date }): Promise<void>;
  resolveSession(tokenHash: string, now: Date): Promise<TenantContext | null>;
  revokeSession(tokenHash: string, now: Date): Promise<boolean>;
  listUserSchools(userId: string): Promise<SchoolMembershipView[]>;
  switchActiveSchool(input: { sessionId: string; userId: string; schoolId: string; now: Date }): Promise<boolean>;
}

export function createAuthRepository<TQueryResult extends PgQueryResultHKT>(db: PgDatabase<TQueryResult, typeof schema>): AuthRepository {
  return {
    async findLoginIdentity(email) {
      const rows = await db.select({
        userId: users.id,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        schoolId: schools.id,
        schoolName: schools.name,
        schoolCode: schools.code,
        role: schoolMemberships.role,
      }).from(users)
        .innerJoin(schoolMemberships, eq(schoolMemberships.userId, users.id))
        .innerJoin(schools, eq(schools.id, schoolMemberships.schoolId))
        .where(and(eq(users.email, email), eq(users.isActive, true), eq(schools.isActive, true)))
        .orderBy(schools.name);

      if (!rows[0]) return null;
      return {
        userId: rows[0].userId,
        fullName: rows[0].fullName,
        passwordHash: rows[0].passwordHash,
        memberships: rows.map(({ schoolId, schoolName, schoolCode, role }) => ({ schoolId, schoolName, schoolCode, role })),
      };
    },

    async createSession(input) {
      await db.insert(sessions).values({
        id: input.id,
        tokenHash: input.tokenHash,
        userId: input.userId,
        activeSchoolId: input.activeSchoolId,
        expiresAt: input.expiresAt,
        createdAt: input.now,
        lastSeenAt: input.now,
      });
    },

    async resolveSession(tokenHash, now) {
      const [row] = await db.select({
        sessionId: sessions.id,
        userId: users.id,
        userName: users.fullName,
        schoolId: schools.id,
        schoolName: schools.name,
        schoolCode: schools.code,
        role: schoolMemberships.role,
      }).from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .innerJoin(schools, eq(schools.id, sessions.activeSchoolId))
        .innerJoin(schoolMemberships, and(
          eq(schoolMemberships.userId, sessions.userId),
          eq(schoolMemberships.schoolId, sessions.activeSchoolId),
        ))
        .where(and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          eq(users.isActive, true),
          eq(schools.isActive, true),
        )).limit(1);
      return row ?? null;
    },

    async revokeSession(tokenHash, now) {
      const rows = await db.update(sessions).set({ revokedAt: now })
        .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      return rows.length === 1;
    },

    async listUserSchools(userId) {
      return db.select({
        schoolId: schools.id,
        schoolName: schools.name,
        schoolCode: schools.code,
        role: schoolMemberships.role,
      }).from(schoolMemberships)
        .innerJoin(schools, eq(schools.id, schoolMemberships.schoolId))
        .where(and(eq(schoolMemberships.userId, userId), eq(schools.isActive, true)))
        .orderBy(schools.name);
    },

    async switchActiveSchool({ sessionId, userId, schoolId, now }) {
      const [membership] = await db.select({ schoolId: schoolMemberships.schoolId })
        .from(schoolMemberships)
        .innerJoin(schools, eq(schools.id, schoolMemberships.schoolId))
        .where(and(
          eq(schoolMemberships.userId, userId),
          eq(schoolMemberships.schoolId, schoolId),
          eq(schools.isActive, true),
        )).limit(1);
      if (!membership) return false;

      const updated = await db.update(sessions).set({ activeSchoolId: schoolId, lastSeenAt: now })
        .where(and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        )).returning({ id: sessions.id });
      return updated.length === 1;
    },
  };
}
