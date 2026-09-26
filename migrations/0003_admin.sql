-- Better Auth admin plugin columns (see scripts/auth-schema.ts for the full generated schema).
alter table "user" add column "banned" integer;
alter table "user" add column "banReason" text;
alter table "user" add column "banExpires" date;
alter table "session" add column "impersonatedBy" text;
