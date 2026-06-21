# PRD — Contract Modification Request App

## 1. Product summary

Build a small local internal web app for contract modification requests.

Today, agents send emails asking admins to modify contract data. The problem is that agents often use business language, not the exact DB2 column names. The app should replace email requests with a controlled workflow:

```txt
Agent submits request → Admin reviews → Admin approves → App updates DB2 → Request is logged
```

Agents should never write SQL and should never need to know DB2 column names. Admins should control the mapping between human labels/business rules and real DB2 columns.

The app is intended for local/internal use, so the security model can stay simple, but users should still have roles and passwords.

---

## 2. Goals

- Let agents create clean contract modification requests.
- Let admins approve, reject, or bulk-approve requests.
- Let admins manage the mapping between friendly labels and DB2 columns.
- Let admins manage users, roles, logins, and passwords.
- Execute safe DB2 updates only after admin approval.
- Keep a clear audit/history of all requests and actions.

---

## 3. Non-goals

- Agents do not write SQL.
- Agents do not choose raw DB2 columns.
- The app does not need to validate that the contract exists before request submission.
- The app does not need enterprise-level authentication/security for the first version.
- The app does not replace the DB2 system; it only updates one fixed table through controlled requests.

---

## 4. User roles

### Agent

Can:

- Log in.
- Create a contract modification request.
- Enter a contract number.
- Add one or more requested modifications.
- Choose fields from a dropdown/search using friendly labels.
- Submit request.
- See their own request history and status.

Cannot:

- Write SQL.
- Directly update DB2.
- Manage mappings.
- Manage users.
- Approve requests.

### Admin

Can:

- See all requests.
- Approve one request.
- Reject one request.
- Approve selected requests.
- Approve all pending requests.
- Manage label-to-column mappings.
- Manage business rules.
- Manage users, roles, logins, and passwords.
- View audit logs.

---

## 5. Main workflow

### Agent request flow

1. Agent logs in.
2. Agent opens “New modification request”.
3. Agent enters the contract number.
4. Agent clicks “Add modification”.
5. Agent chooses a friendly business label from a dropdown/search.
6. Agent enters the new value.
7. Agent can add more modifications.
8. Agent submits the request.
9. Request is saved as `pending`.

No DB2 update happens during this step.

Example:

| Field | Value |
|---|---|
| Contract number | `1029638` |
| Code envoi | `2` |
| Demande de substitution | `V2292188` |

Behind the scenes, the app stores the trusted mapping:

| Friendly label | DB2 column |
|---|---|
| Code envoi | `CDENVO` |
| Demande de substitution | `NOCPA1` |

---

### Admin approval flow

1. Admin opens pending requests.
2. Admin reviews the request details.
3. Admin sees both the friendly label and the DB2 column.
4. Admin clicks approve or reject.
5. If approved, the backend executes a DB2 update.
6. Request status becomes `approved`, `rejected`, or `failed`.

Example admin view:

| Friendly label | DB2 column | New value |
|---|---|---|
| Code envoi | `CDENVO` | `2` |
| Demande de substitution | `NOCPA1` | `V2292188` |

Conceptual SQL:

```sql
UPDATE TARGET_TABLE
SET CDENVO = ?, NOCPA1 = ?
WHERE CONTRACT_NUMBER_COLUMN = ?
```

Important:

- The table name is fixed in backend configuration.
- The contract number column is fixed in backend configuration.
- DB2 values must be parameterized.
- DB2 columns must come only from the approved mapping table.
- Raw column names from users must never be trusted.

---

## 6. Core features

### 6.1 Login and roles

Simple local login system.

Fields:

- username/login
- password
- role: `agent` or `admin`
- active/inactive

Even though the app is local, passwords should preferably be hashed because it is easy and safer than storing plain text.

---

### 6.2 Agent request form

The form should contain:

- Contract number
- Add modification button
- Modification rows
- Optional comment
- Submit button

Each modification row should contain:

- Friendly field label dropdown/search
- New value input
- Optional note/help text

Validation:

- Contract number required.
- At least one modification required.
- New value required unless the selected mapping allows empty values.
- Prevent duplicate field selection inside the same request, or handle it clearly.

---

### 6.3 Admin request dashboard

Admin should see:

- Pending requests
- Approved requests
- Rejected requests
- Failed requests

Useful filters:

- status
- contract number
- requested by
- date

Each request should show:

- request id
- contract number
- requested by
- created date
- number of modifications
- status
- approve/reject actions

---

### 6.4 Approve all / bulk approve

Admin should be able to:

- select multiple pending requests and approve them
- click “Approve all pending”

Recommended behavior:

- Process each request separately.
- Use one DB transaction per request.
- If one request fails, continue processing the others.
- Show a final summary.

Example:

```txt
Bulk approval complete
Approved: 18
Failed: 2
Rejected: 0
```

If a request fails, store the DB2 error message or a clean failure reason.

---

### 6.5 Label-to-column mapping admin

Admins need a page to manage field mappings.

Each mapping should include:

- friendly label shown to agents
- DB2 column name
- data type: text, number, date, enum
- active/inactive
- required/optional
- validation rule
- help text for agents
- admin note

Example:

| Friendly label | DB2 column | Type | Active |
|---|---|---|---|
| Code envoi | `CDENVO` | text/number | yes |
| Demande de substitution | `NOCPA1` | text | yes |

This allows admins to encode the real business logic they currently keep in their heads.

---

### 6.6 Business rules mapping

Because some updates depend on internal admin knowledge, the app should support a simple business rules configuration.

Example:

| Business request | Field shown to agent | DB2 column | Rule/comment |
|---|---|---|---|
| Demande de substitution | Dossier de substitution | `NOCPA1` | Confirmed by admin |
| Code envoi | Code envoi | `CDENVO` | Confirm accepted values |

For MVP, this can be the same as the field mapping page. Later it can become a richer rules page.

---

### 6.7 User management

Admin should be able to:

- create user
- edit login/username
- reset password
- change role
- activate/deactivate user

User fields:

- id
- username
- password hash
- role
- is active
- created at
- updated at

---

### 6.8 Audit log

The app should log important actions:

- user logged in
- request created
- request approved
- request rejected
- request failed
- mapping created/edited/deactivated
- user created/edited/deactivated
- password reset

Audit log should include:

- actor
- action
- request id if relevant
- timestamp
- details JSON/text

---

## 7. Data model

### users

```txt
id
username
password_hash
role
is_active
created_at
updated_at
```

### field_mappings

```txt
id
label
db_column
data_type
is_required
is_active
validation_rule
help_text
admin_note
created_at
updated_at
```

### modification_requests

```txt
id
contract_number
status
requested_by_user_id
approved_by_user_id
created_at
approved_at
rejected_at
failure_reason
comment
```

### modification_request_items

```txt
id
request_id
field_mapping_id
label_snapshot
db_column_snapshot
new_value
created_at
```

Snapshot fields are important because mappings may change later. Old requests should still show what was used at the time.

### audit_logs

```txt
id
actor_user_id
action
request_id
details_json
created_at
```

---

## 8. Request statuses

Use:

```txt
pending
approved
rejected
failed
cancelled
```

For MVP, each request should be all-or-nothing. If one item in a request fails, the full request should become `failed`.

---

## 9. DB2 behavior

The app updates one fixed DB2 table.

The app does not need to check if the contract exists before request submission.

On approval:

- build the update from trusted mappings
- run the DB2 update
- if DB2 returns success, mark request as approved
- if DB2 returns an error, mark request as failed
- if zero rows are updated, mark request as failed or approved-with-warning depending on admin preference

Recommended default:

```txt
0 rows updated = failed
```

because it probably means the contract number was wrong or not found.

---

## 10. MVP scope

Build first:

- Login
- Roles: agent/admin
- Agent request form
- Admin pending dashboard
- Approve one request
- Reject one request
- Field mapping management
- User management
- Basic audit log
- DB2 connection to local Docker DB2

Build next:

- Approve selected requests
- Approve all pending
- Better business rules page
- Better validation per field
- Request search/filter
- Export history to CSV/Excel

---

## 11. Testing plan

Use Docker to create a local DB2 database for development/testing.

Suggested test stack:

- Web app backend
- Local app database, such as SQLite or Postgres
- DB2 Docker container
- Fake DB2 table
- Seed fake contract rows

Example fake DB2 table:

```sql
CREATE TABLE CONTRATS (
  NO_CONTRAT VARCHAR(20) PRIMARY KEY,
  CDENVO VARCHAR(10),
  NOCPA1 VARCHAR(50),
  NODOSS VARCHAR(50),
  UPDATED_AT TIMESTAMP
);
```

Example seed row:

```sql
INSERT INTO CONTRATS (NO_CONTRAT, CDENVO, NOCPA1, NODOSS)
VALUES ('1029638', '1', '', '');
```

Core test cases:

1. Agent creates request with one field.
2. Agent creates request with multiple fields.
3. Admin approves one request.
4. DB2 row is updated correctly.
5. Admin rejects request.
6. Rejected request does not update DB2.
7. Admin approves all pending.
8. One request fails, others still approve during bulk approval.
9. Agent cannot access admin pages.
10. Disabled mapping does not appear in agent dropdown.
11. Admin edits mapping; new requests use new mapping.
12. Old requests keep old mapping snapshot.
13. Admin resets user password.
14. Invalid value is blocked before approval.
15. Duplicate field in same request is blocked or handled clearly.

---

## 12. Recommended build order

1. Create app skeleton.
2. Add login and roles.
3. Add app database schema.
4. Seed one admin and one agent.
5. Add hardcoded/sample mappings.
6. Build agent request form.
7. Build admin pending dashboard.
8. Implement approve/reject for one request.
9. Connect to Docker DB2 and run real update against fake table.
10. Add mapping management UI.
11. Add user management UI.
12. Add approve all / bulk approval.
13. Add audit log and filters.

---

## 13. Open questions for admins

Before finalizing the mapping list, ask admins:

| Business request | Example email/request | DB2 column | Accepted values | Notes |
|---|---|---|---|---|
| Demande de substitution | Contract + dossier substitution | `NOCPA1`? | text? | confirm |
| Code envoi | Contract + code envoi | `CDENVO`? | 1/2/etc? | confirm |
| Demande de réservation | ? | ? | ? | confirm |

Main question:

> Pour chaque type de modification que vous recevez par email, quelle colonne exacte est modifiée dans DB2, et dans quel cas ?

