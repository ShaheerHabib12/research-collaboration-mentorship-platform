'use strict';

// Database schema tests (FR-042 to FR-044, NFR-001).
// They need a running PostgreSQL and the DATABASE_URL environment variable.
// Without DATABASE_URL the whole file is skipped, so `npm test` still works
// on a laptop with no database. In CI a PostgreSQL service provides it.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

suite('database schema constraints', () => {
  let client;

  beforeAll(async () => {
    const setup = new Client({ connectionString: process.env.DATABASE_URL });
    await setup.connect();
    const sql = fs.readFileSync(path.join(__dirname, '../db/init.sql'), 'utf8');
    await setup.query(sql);
    await setup.end();
  });

  // Each test runs inside a transaction that is rolled back,
  // so no test data is ever left in the database.
  beforeEach(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('BEGIN');
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
    await client.end();
  });

  async function makeUserAndProject() {
    const user = await client.query(
      "INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'hash') RETURNING id",
    );
    const userId = user.rows[0].id;
    const project = await client.query(
      "INSERT INTO projects (owner_id, title, research_question) VALUES ($1, 'Test project', 'Why?') RETURNING id",
      [userId],
    );
    return { userId, projectId: project.rows[0].id };
  }

  function insertTask(projectId, userId, title, description = null, tags = []) {
    return client.query(
      'INSERT INTO tasks (project_id, title, description, tags, created_by) VALUES ($1, $2, $3, $4, $5)',
      [projectId, title, description, tags, userId],
    );
  }

  test('creates the four starter tables', async () => {
    const res = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = res.rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(['users', 'projects', 'workspace_members', 'tasks']));
  });

  test('rejects a 2-character task title', async () => {
    const { userId, projectId } = await makeUserAndProject();
    await expect(insertTask(projectId, userId, 'ab')).rejects.toThrow(/check constraint/i);
  });

  test('accepts task titles of 3 and 20 characters', async () => {
    const { userId, projectId } = await makeUserAndProject();
    await expect(insertTask(projectId, userId, 'abc')).resolves.toBeDefined();
    await expect(insertTask(projectId, userId, 'a'.repeat(20))).resolves.toBeDefined();
  });

  test('rejects a 21-character task title', async () => {
    const { userId, projectId } = await makeUserAndProject();
    await expect(insertTask(projectId, userId, 'a'.repeat(21))).rejects.toThrow(/check constraint/i);
  });

  test('accepts three tags but rejects a fourth', async () => {
    const { userId, projectId } = await makeUserAndProject();
    await expect(insertTask(projectId, userId, 'Three tags', null, ['a', 'b', 'c'])).resolves.toBeDefined();
    await expect(insertTask(projectId, userId, 'Four tags', null, ['a', 'b', 'c', 'd'])).rejects.toThrow(
      /check constraint/i,
    );
  });

  test('rejects a task description longer than 250 characters', async () => {
    const { userId, projectId } = await makeUserAndProject();
    await expect(insertTask(projectId, userId, 'Long text', 'x'.repeat(250))).resolves.toBeDefined();
    await expect(insertTask(projectId, userId, 'Too long', 'x'.repeat(251))).rejects.toThrow(
      /check constraint/i,
    );
  });

  test('rejects an unknown platform role', async () => {
    await expect(
      client.query("INSERT INTO users (email, password_hash, platform_role) VALUES ('x@example.com', 'h', 'superuser')"),
    ).rejects.toThrow(/check constraint/i);
  });
});
