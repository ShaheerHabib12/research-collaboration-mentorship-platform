# Database schema

The schema is in `server/db/init.sql` (component C8). It is the starter version for Iteration 1 and will grow one table at a time.

## Tables

| Table | Key columns | Requirements |
|---|---|---|
| `users` | `email` (unique), `password_hash`, `platform_role` | FR-001 to FR-003, NFR-002 |
| `projects` | `owner_id`, `title`, `research_question`, `stage`, `visibility`, `status` | FR-007 to FR-010 |
| `workspace_members` | `project_id`, `user_id`, `role` (primary key on both ids) | FR-027, FR-032, NFR-001 |
| `tasks` | `project_id`, `title`, `description`, `tags`, `due_date`, `status`, `created_by` | FR-028, FR-042 to FR-044 |

## Rules enforced by the database

| Rule | How |
|---|---|
| Task title is 3 to 20 characters | `CHECK (char_length(title) BETWEEN 3 AND 20)` |
| Task description is optional and up to 250 characters | `CHECK (description IS NULL OR char_length(description) <= 250)` |
| A task has at most three tags | `CHECK (cardinality(tags) <= 3)` |
| Platform role is `user` or `administrator` | `CHECK (platform_role IN (...))` |
| Project stage, visibility and status use fixed values | `CHECK` constraints on each column |
| Deleting a project removes its tasks and memberships | `ON DELETE CASCADE` |
| A user cannot be deleted while they own a project or created a task | `ON DELETE RESTRICT` |

## Relationships

- One user owns zero or more projects.
- A project has one or more members through `workspace_members`.
- A project has zero or more tasks.

## Tests

`server/tests/schema.test.js` loads `init.sql` and checks each rule above (for example, a 2-character and a 21-character title are rejected, a fourth tag is rejected). The tests run inside transactions that are rolled back. They run in CI against a PostgreSQL 16 service, and are skipped locally when `DATABASE_URL` is not set.

## Changing the schema

Docker runs `init.sql` only when the database volume is first created. After editing the file, reset the local database:

```bash
docker compose down -v
docker compose up -d
```

This deletes local data.
