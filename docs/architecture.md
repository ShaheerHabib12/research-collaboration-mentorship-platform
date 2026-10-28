# Architecture notes

Short reference that mirrors the architecture diagram in the coursework report. Update it whenever the design changes.

## Layers and components

| ID | Component | Layer | Notes |
|---|---|---|---|
| C1 | Web client | Presentation | React forms, validation, status and error display |
| C2 | API gateway and authentication | Application | JWT login, role checks, input validation, routes to module APIs |
| C3 | User and profile service | Application | Registration, login, profiles, availability, `getProfile()` |
| C4 | Project and collaboration service | Application | Briefs, interests, invitations, agreements |
| C5 | Mentorship service | Application | Mentor discovery, support requests, assignment; calls C3 `getProfile()` |
| C6 | Workspace and file service | Application | `checkMembership(user, project)`, tasks, milestones, files up to 10 MB |
| C7 | Notification module | Application | Notifications, reports, moderation, after-save event bus |
| C8 | PostgreSQL database | Data | Relational records and file metadata |
| C9 | Encrypted file storage | Data | Encrypted file contents, key handling, backups |
| C10 | Subscription and compensation module | Application | Plans, entitlements, billing, bonus (70% requests, 30% feedback) |

## Flows

1. Synchronous API and data flow: C1 to C2 to module APIs to the shared database access layer (parameterised SQL) to C8.
2. In-process calls: C5 calls C3 `getProfile()`; C10 passes an eligible support request to C5 after the entitlement check.
3. After-save events: C4, C5, C6 and C10 raise events on the C7 event bus after saving a change.
4. Payment request and confirmation: C10 and the approved external payment provider.
5. Encrypted file I/O: C6 and C9.

## Security boundaries

- C8 stores relational records and file metadata; C9 stores encrypted file contents.
- C2 checks the JWT and platform role; C4 and C6 enforce resource permissions.
- No raw payment-card details are stored, only provider references and statuses.
- Key handling, backups and restore tests are required for stored data.

## Where code goes

Create one folder per module under `server/src/modules/` (for example `server/src/modules/account/`) with its routes, service and tests, and mount its router in `server/src/app.js`.
