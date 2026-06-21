# Prompt for Codex — Build Local Contract Modification Request App

I want you to build a small local internal web app on my MacBook for contract modification requests.

Read and follow the PRD in `prd-contract-modification-app.md`.

## Product summary

The app replaces email-based contract modification requests.

Flow:

```txt
Agent submits request → Admin reviews → Admin approves → App updates DB2 → Request is logged
```

Agents must never write SQL and must never choose raw DB2 columns. Agents choose friendly business labels. Admins manage the mapping from friendly labels to DB2 columns.

The app is for local/internal use, so security can be simple, but still implement username/password login, roles, and password hashing.

## Suggested stack

Use a simple, maintainable full-stack setup. My preferred direction:

- Next.js app
- TypeScript
- Tailwind/shadcn if useful
- Prisma with SQLite for the app database
- IBM DB2 driver/package for DB2 access
- Docker Compose for local DB2 testing

If you think another stack is simpler, explain briefly before changing it.

## Core features to build

### 1. Auth and roles

Create simple local auth:

- login page
- username/password
- password hashing
- session cookie
- roles: `agent`, `admin`
- seed one admin and one agent

Example seed users:

```txt
admin / admin123
agent / agent123
```

### 2. Agent area

Agent can:

- create a new modification request
- enter contract number
- add one or more modification rows
- choose field from dropdown/search using friendly labels
- enter new value
- submit request
- see own request history and statuses

Request status after submission: `pending`.

No DB2 update should happen when the agent submits.

### 3. Admin area

Admin can:

- view all requests
- filter by status
- open request details
- approve one request
- reject one request
- approve selected requests
- approve all pending requests

On approval:

- get request items
- use the stored DB column snapshots
- build a safe DB2 update
- use parameterized values
- only allow columns that exist in the trusted mapping table/snapshots
- update the fixed DB2 table
- mark request as `approved` if successful
- mark request as `failed` if DB2 update fails

For bulk approve:

- process each request separately
- one transaction per request
- continue if one request fails
- show summary: approved count, failed count

### 4. Field mapping management

Admin can create/edit/deactivate mappings.

Mapping fields:

- label
- dbColumn
- dataType: text, number, date, enum
- isRequired
- isActive
- validationRule
- helpText
- adminNote

Agents only see active mappings.

When a request is created, store snapshots:

- labelSnapshot
- dbColumnSnapshot

This protects old requests if mappings change later.

### 5. User management

Admin can:

- create user
- edit username/login
- reset password
- change role
- activate/deactivate user

### 6. Audit log

Log:

- request created
- request approved
- request rejected
- request failed
- mapping created/edited/deactivated
- user created/edited/deactivated
- password reset

## DB2 local testing

Set up Docker Compose with IBM DB2 Community Edition for local development/testing.

Create a fake DB2 database/table:

```sql
CREATE TABLE CONTRATS (
  NO_CONTRAT VARCHAR(20) PRIMARY KEY,
  CDENVO VARCHAR(10),
  NOCPA1 VARCHAR(50),
  NODOSS VARCHAR(50),
  UPDATED_AT TIMESTAMP
);
```

Seed:

```sql
INSERT INTO CONTRATS (NO_CONTRAT, CDENVO, NOCPA1, NODOSS)
VALUES ('1029638', '1', '', '');
```

The app should use a fixed target table and fixed contract number column in config:

```txt
DB2_TARGET_TABLE=CONTRATS
DB2_CONTRACT_COLUMN=NO_CONTRAT
```

Important:

- The app does not need to check if the contract exists before an agent submits a request.
- On admin approval, if DB2 updates 0 rows, mark the request as `failed` by default.

## Sample mappings to seed

Seed these first:

```txt
Code envoi → CDENVO → text
Demande de substitution → NOCPA1 → text
Numéro dossier → NODOSS → text
```

## Database models needed

Create app database models for:

- User
- FieldMapping
- ModificationRequest
- ModificationRequestItem
- AuditLog

Statuses:

```txt
pending
approved
rejected
failed
cancelled
```

## UI pages

Build at least:

```txt
/login
/agent/requests
/agent/requests/new
/admin/requests
/admin/requests/[id]
/admin/mappings
/admin/users
/admin/audit
```

Redirect users based on role after login.

## Development style

Please work step by step:

1. Inspect the folder.
2. Propose the exact stack and file structure.
3. Scaffold the app.
4. Add database schema and seed.
5. Add auth.
6. Add agent request creation.
7. Add admin request approval/rejection.
8. Add DB2 Docker/local integration.
9. Add mappings management.
10. Add user management.
11. Add audit log.
12. Add approve all.
13. Run tests/manual checks.
14. Give me clear run instructions.

Keep the code simple and local-first. Avoid over-engineering.

## Acceptance criteria

The project is done when:

- I can run the app locally.
- I can log in as admin and agent.
- Agent can submit a request.
- Admin can approve it.
- Approval updates the local Docker DB2 `CONTRATS` table.
- Admin can reject a request.
- Admin can approve all pending requests.
- Admin can create/edit field mappings.
- Admin can create/edit users and reset passwords.
- Audit log records important actions.
- There is a README explaining setup, Docker DB2, seed users, and how to test.

