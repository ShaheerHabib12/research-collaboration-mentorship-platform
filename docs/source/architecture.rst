Architecture
============

Tier 1, the client, is static HTML, CSS and JavaScript. Business rules that both
tiers need (``validators.js``, ``rules.js``, ``constants.js``) are written once as
UMD modules and loaded by the browser and by Node, so a rule cannot differ
between the form and the server.

Tier 2, the server, is a router and gateway (``app.js``), the business
services (``services.js``), authentication (``auth.js``), encrypted file
storage (``storage.js``) and the help assistant (``assistant.js``).

Tier 3 is PostgreSQL. Foreign keys, ``CHECK`` constraints and unique indexes
repeat the most important rules so that a defect in the application cannot
store an impossible record.

Unit of Work
------------

Each request loads the collections in one query, applies the rules to plain
objects, then writes only the difference back in one transaction. Writers are
serialised with ``pg_advisory_xact_lock``; reads run in a read-only
``REPEATABLE READ`` snapshot. If any step fails, the whole request rolls back.

Design changes from Coursework 1 are listed with their rationale in
``docs/ARCHITECTURE.md`` and in the report.
