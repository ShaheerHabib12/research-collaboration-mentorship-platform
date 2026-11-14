Module reference
================

``server/app.js``
-----------------

app.js - C2 API gateway, built on Express 5. Request pipeline: helmet security headers -> HTTPS redirect -> CORS -> throttles -> JSON body -> authenticate (JWT) -> route -> ONE database transaction (services.js) -> JSON response. Nothing is reported as saved before the transaction has committed (NFR-010). Logs never contain passwords, tokens or request bodies (NFR-016). In production the React build in client/dist is served from the same origin, so no cross-origin access is needed.

Functions: ``buildRoutes``, ``createApp``, ``makeCtx``, ``errorBody``, ``normalise``, ``respond``.

``server/services.js``
----------------------

services.js - Layer 2 (application) business logic: modules C3-C7 and C10. Each exported function is one use of the API. It receives a request context (`ctx`: authenticated user id, simulation flags, the Unit of Work in `ctx.db`) and returns plain JSON-serialisable data. Functions run inside ONE database transaction (see db.js) so a failure never leaves partial data (NFR-009, NFR-010). Pure rules (validators.js, rules.js) are shared with the browser and unit-tested in isolation (NFR-017). Status codes (Tables 7 and 13): 400 validation, 401 not signed in / expired, 402 plan limit, 403 forbidden, 404 not found, 409 conflict, 413 file too large, 500 save failed.

Functions: ``now``, ``ago``, ``inDays``, ``clone``, ``lower``, ``nextId``, ``guard``, ``findProject``, ``isMember``, ``sharesProject``, ``userById``, ``mini``, ``requireMember``, ``notify``, ``audit``, ``activity``, ``periodRequests``, ``planOf``, ``entitlement``, ``requireEntitlement``, ``profileFor``, ``publicUser``, ``issuePin``, ``projectView``, ``requestView``, ``agreementView``, ``taskView``, ``mentorRequestView``, ``supportView``, ``matchResearcher``, ``load2``, ``statementView``, ``move``, ``api.register``, ``api.login``, ``api.forgotPassword``, ``api.verifyEmail``, ``api.resendPin``, ``api.resetPassword``, ``api.assistant``, ``api.me``, ``api.summary``, ``api.getProfile``, ``api.updateProfile``, ``api.exportMyData``, ``api.deleteMyAccount``, ``api.searchProjects``, ``api.searchPeople``, ``api.myProjects``, ``api.getProject``, ``api.saveProject``, ``api.setProjectStatus``, ``api.sendInterest``, ``api.sendInvitation``, ``api.listRequests``, ``api.actOnRequest``, ``api.getAgreement``, ``api.saveAgreement``, ``api.acknowledgeAgreement``, ``api.proposeRevision``, ``api.resolveProposal``, ``api.getWorkspace``, ``api.saveTask``, ``api.moveTask``, ``api.deleteTask``, ``api.toggleMilestone``, ``api.addMilestone``, ``api.uploadFile``, ``api.openFile``, ``api.readFile``, ``api.deleteFile``, ``api.searchMentors``, ``api.requestMentorship``, ``api.listMentorRequests``, ``api.actOnMentorRequest``, ``api.toggleAccepting``, ``api.createSupport``, ``api.listSupport``, ``api.updateSupport``, ``api.feedbackSupport``, ``api.getSubscription``, ``api.subscribe``, ``api.settlePending``, ``api.cancelSubscription``, ``api.listStatements``, ``api.actOnStatement``, ``api.adminOverview``, ``api.listResearchers``, ``api.updateResearcher``, ``api.reportContent``, ``api.sendContact``, ``api.listContact``, ``api.setContactStatus``, ``api.listReports``, ``api.actOnReport``, ``api.listAudit``, ``api.listNotifications``, ``api.markRead``, ``api.getPrefs``, ``api.setPrefs``, ``api.dashboard``.

``server/auth.js``
------------------

auth.js - password hashing (NFR-002) and JSON Web Tokens (C2, NFR-001). Passwords: bcrypt (adaptive, per-account random salt; the salt and cost are stored inside the hash). Raw passwords are never logged. Unknown accounts still cost one bcrypt comparison so response time does not reveal whether an email exists. Tokens: HS256 JWT (RFC 7519, Jones et al., 2015) issued and checked with `jsonwebtoken`. Claims: sub (user id), iat, exp (8 h), optional pv (password fingerprint) and purpose.

Functions: ``hashPassword``, ``verifyPassword``, ``signToken``, ``verifyToken``, ``pwFingerprint``, ``newPin``, ``pinHash``, ``pinMatches``.

``server/db.js``
----------------

db.js - Layer 3 (data) access: PostgreSQL schema, constraints and Unit of Work. Design (see docs/ARCHITECTURE.md): - Every aggregate has its own table with real PRIMARY/FOREIGN keys, UNIQUE indexes and CHECK constraints on the columns that protect integrity (email, roles, request status, one pending request per user/project, one statement per researcher/period, file size <= 10 MiB ...). - The full entity is also stored as JSONB in `data`, which keeps the domain code simple while the columns above stay queryable and constrained. - A Unit of Work loads the collections at the start of the request (one round trip), the domain code works on plain objects, and the changes are detected by comparing snapshots and written in ONE transaction. If anything throws, the transaction rolls back and nothing is stored (NFR-009, NFR-010). - Writers are serialised with a transaction-scoped advisory lock so that two requests can never both read the old state and overwrite each other (the "lost update" problem). Reads run concurrently in a REPEATABLE READ snapshot. Row-level locking / optimistic versions are the next step if the write rate ever outgrows this (documented limitation).

Functions: ``migrate``, ``wipe``, ``transact``.

``server/pool.js``
------------------

pool.js - the database connection pool, built on the official `pg` package (node-postgres). A thin wrapper that gives the rest of the server three small methods: pool.query(text, params)        one statement on any free connection pool.withClient(fn)             one connection, held exclusively (transactions) client.exec(sql)                a multi-statement script (migrations) All values travel as bound parameters ($1, $2 ...), never concatenated into SQL (NFR-004).

Functions: ``parseUrl``.

``server/storage.js``
---------------------

storage.js - C9 encrypted file store (NFR-001, FR-029). Files are encrypted with AES-256-GCM before they touch the disk. Each file gets its own random 12-byte IV and authentication tag, and is stored as [iv(12)] [tag(16)] [ciphertext] under an opaque id, never under the user's file name (path traversal is impossible). The key comes from RCMP_FILE_KEY (32 bytes, hex) - in production it belongs in a secrets manager, never in the repository.

Functions: ``createStorage``.

``server/mailer.js``
--------------------

mailer.js - sends e-mail through an HTTPS API (no SMTP, no dependencies). Why an HTTP API: free hosts such as Render block outgoing SMTP ports, but HTTPS always works. RCMP_MAIL_PROVIDER   brevo | resend | console   (empty = e-mail is off) RCMP_MAIL_API_KEY    the provider's API key (a secret: set it on the host, never commit it) RCMP_MAIL_FROM       sender address; must be verified with the provider RCMP_MAIL_FROM_NAME  display name (default "RCMP") "console" prints the message to the server log instead of sending it. It is for development only, because it would put PINs in the log.

Functions: ``createMailer``, ``post``, ``pinMessage``, ``resetMessage``.

``server/assistant.js``
-----------------------

assistant.js - "Scout", the in-product help assistant (tier 2). Scout is NOT a large language model. It is a small retrieval assistant: the user's question is normalised, matched against a curated knowledge base about this platform, and the best-matching, hand-written answer is returned. That is deliberate: - answers can only state what RCMP really does (limits and plans are read from the same constants the rest of the system uses); - there is no external service, key, cost or data leaving the system; - anything outside the platform is declined, which is the required behaviour; - it is fully deterministic, so it can be unit-tested (tests/assistant.test.js). The user's text is never echoed back, so it cannot be reflected as markup. answer(message, who) -> { reply, links:[{label,href}], chips:[string], topic, inScope } who (optional, signed-in users): { name, role, plan:{name,price,allowance}, used, remaining, pending, projects, unread }

Functions: ``stem``, ``personal``, ``answer``.

``server/backup.js``
--------------------

backup.js - NFR-008: scheduled backup with a manifest, and a restore check. node server/backup.js backup [dir]        -> pg_dump (custom format) + manifest node server/backup.js verify <dir> <file> -> restore into a scratch database and compare Needs the PostgreSQL client tools (pg_dump, pg_restore) on PATH, or PG_BIN pointing at their folder. The manifest records per-table row counts, the SHA-256 of the dump and the time taken: the evidence NFR-008 asks for (RPO 24 h / RTO 4 h). A restore is only considered good if the restored row counts equal the manifest.

Functions: ``env``, ``counts``, ``backup``, ``verifyRestore``.

``shared/validators.js``
------------------------

validators.js --------------------------------------------------------------------------- Pure input-validation functions for the Research Collaboration and Mentorship Platform (RCMP) front end. Every function is side-effect free so it can be unit-tested in Node (tests/validators.test.js) and reused in the browser (window.RCMPValidators). Each validator returns   { ok: boolean, error?: string, value?: any } Requirement traceability FR-042  Task title 3-20 characters ............ validateTaskTitle FR-043  Task description <= 250 characters .... validateTaskDescription FR-044  At most three optional tags ........... validateTags FR-029  File upload, 10 MB limit (NFR-018) .... validateFile FR-001  Registration ............................ validateEmail / validatePassword / validateName FR-007  Project brief ........................... validateProjectBrief FR-014  Interest message ........................ validateMessage FR-020  Mentorship request ...................... validateMentorshipRequest NFR-004 Input sanitisation (XSS / injection) .... escapeHtml / sanitizeText ---------------------------------------------------------------------------

Functions: ``ok``, ``fail``, ``escapeHtml``, ``sanitizeText``, ``validateEmail``, ``validatePassword``, ``passwordStrength``, ``validateName``, ``validateTaskTitle``, ``validateTaskDescription``, ``validateTags``, ``sanitizeFileName``, ``validateFile``, ``validateMessage``, ``validateProjectBrief``, ``validateMentorshipRequest``, ``validateProfile``, ``validateFeedback``.

``shared/rules.js``
-------------------

rules.js --------------------------------------------------------------------------- Pure business rules for RCMP. No DOM, no storage - so they are trivially unit-testable (tests/rules.test.js). canTransitionRequest ... FR-016 / NFR-009  legitimate request transitions only allowanceSummary ....... FR-045..047, UC-06/UC-07 subscription allowance calcCompensation ....... FR-053..055, UC-08   70% requests / 30% feedback bonus filterAndPage .......... FR-012/013, NFR-015  search filters + pagination canViewField ........... FR-005 / FR-009      profile & project visibility ---------------------------------------------------------------------------

Functions: ``canTransitionRequest``, ``canActOnRequest``, ``allowanceSummary``, ``calcCompensation``, ``canTransitionStatement``, ``filterAndPage``, ``canViewField``, ``shouldDeliverNotification``.

``shared/constants.js``
-----------------------

constants.js - reference data shared by the browser and the server (UMD). Plans, allowances, subjects and the compensation configuration live in ONE place so the interface and the API can never disagree (NFR-012, NFR-017). Prices, allowances and bonus caps are proposals pending stakeholder validation (Table 14 of the specification).

Functions: ``colorFor``, ``initials``.

``client/src/lib/api.js``
-------------------------

api.js - browser side of the three-tier system. Every call is an HTTP request to the Express API (server/), which validates, authorises and stores data in PostgreSQL. Nothing here decides business rules. status 0  cannot reach the server      401  session missing/expired (session cleared) others    as documented in docs/API.md The JWT lives in localStorage (rcmp.session.v1). Residual XSS risk is documented in docs/SECURITY.md: React escapes all output and the server sends a strict CSP.

Functions: ``setSession``.

``client/src/components/Scout.jsx``
-----------------------------------

See source.

Functions: ``Mascot``, ``wiggle``, ``ask``.

