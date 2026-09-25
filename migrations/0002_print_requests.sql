create table "print_request" (
  "id" text not null primary key,
  "title" text not null,
  "link" text,
  "details" text not null default '',
  "material" text not null,
  "color" text not null,
  "quantity" integer not null,
  "status" text not null,
  "declineReason" text,
  "requesterId" text not null references "user" ("id") on delete cascade,
  "createdAt" text not null,
  "updatedAt" text not null
);

create index "print_request_status_idx" on "print_request" ("status", "createdAt");
create index "print_request_requester_idx" on "print_request" ("requesterId");

create table "request_event" (
  "id" integer primary key autoincrement,
  "requestId" text not null references "print_request" ("id") on delete cascade,
  "status" text not null,
  "actorId" text not null references "user" ("id") on delete cascade,
  "at" text not null
);

create index "request_event_request_idx" on "request_event" ("requestId");

create table "comment" (
  "id" integer primary key autoincrement,
  "requestId" text not null references "print_request" ("id") on delete cascade,
  "authorId" text not null references "user" ("id") on delete cascade,
  "body" text not null,
  "at" text not null
);

create index "comment_request_idx" on "comment" ("requestId");
