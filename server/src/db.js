'use strict';

const { Pool } = require('pg');

// One shared pool. Modules must use parameterised queries only,
// for example: pool.query('SELECT * FROM users WHERE id = $1', [id]).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = { pool };
