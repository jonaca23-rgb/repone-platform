import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * BetterAuth's own tables — email/password, Google and the database-backed rate
 * limiter, nothing else. They mirror supabase/migrations/0028_better_auth.sql
 * column for column; the migration is the source of truth, this is how the
 * drizzleAdapter reads it.
 *
 * ids are `uuid`, not BetterAuth's default text: auth.uid() casts the minted
 * JWT's `sub` to uuid and every domain FK (profiles.id, user_roles.user_id, …)
 * is a uuid. BetterAuth is configured with generateId: "uuid" to match.
 *
 * RepOne's organizations, roles and event assignments are its own tables, so
 * none of BetterAuth's organization/admin columns are here. `user` is a
 * reserved word in Postgres; Drizzle quotes identifiers, so it is `"user"`.
 */

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** A person who can sign in. Inserting one creates their profiles row (trigger in 0028). */
export const user = pgTable("user", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

/** A credential: providerId "credential" holds the password hash, "google" the OAuth link. */
export const account = pgTable(
  "account",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/**
 * Rate-limit counters. In memory they would be per serverless instance, so an
 * attacker spread across instances is barely limited; here every instance
 * shares one count.
 */
export const rateLimit = pgTable("rate_limit", {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});
