-- Starter schema (C8). Extend one table at a time and keep this file in step with C8.
-- Passwords are stored only as salted hashes (never plain text).
-- Safe to run more than once: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  platform_role TEXT NOT NULL DEFAULT 'user'
                CHECK (platform_role IN ('user', 'administrator')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Research project briefs (FR-007 to FR-010).
CREATE TABLE IF NOT EXISTS projects (
  id                SERIAL PRIMARY KEY,
  owner_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  research_question TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  stage             TEXT NOT NULL DEFAULT 'idea'
                    CHECK (stage IN ('idea', 'planning', 'in_progress', 'writing', 'complete')),
  visibility        TEXT NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private', 'members', 'public')),
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'paused', 'closed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who belongs to a project workspace (FR-027, FR-032, NFR-001).
-- Acceptance of an invitation or interest request creates a row here.
CREATE TABLE IF NOT EXISTS workspace_members (
  project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('owner', 'member', 'mentor')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- Workspace tasks (FR-028, FR-042 to FR-044).
--   title:       3 to 20 characters
--   description: optional, up to 250 characters
--   tags:        at most three
CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 20),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 250),
  tags        TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 3),
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'done')),
  created_by  INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members (user_id);
