Testing
=======

Every test runs against the real HTTP server and a real PostgreSQL database; no
mocks are used. The commands are ``npm test`` (all tests), ``npm run coverage``
(coverage gate: lines 90 percent, functions 85 percent) and ``npm run load``
(50 concurrent users).

The test plan, the input-partition tables and the plan-to-test traceability are
in ``docs/TEST_PLAN.md``. The requirement-to-test mapping is the
:doc:`requirements` page.
