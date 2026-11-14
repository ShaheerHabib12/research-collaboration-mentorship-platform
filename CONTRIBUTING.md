# Contributing (Team 02)

## Branching
- `main` is always releasable: changes arrive only through a pull request that passes CI and has one review. Enforce it with branch protection (GitHub, Settings, Branches, Add rule for `main`).
- Branch names: `feature/<issue-no>-<short-name>`, `fix/<issue-no>-<short-name>`, `docs/<topic>`.
- Small, focused commits; message format `area: what changed (#issue)`, e.g. `agreements: reject stale base version (#14)`.

## Workflow
1. Open or pick an issue (templates in `.github/ISSUE_TEMPLATE`); label it with the requirement id.
2. Create a branch from `main`, write the test case first (see `docs/TEST_PLAN.md`), then the code.
3. `npm test` and `npm run coverage` locally. Tests need PostgreSQL: `docker compose up -d db` then `export TEST_DATABASE_URL=postgres://rcmp:rcmp@localhost:5432/postgres`.
4. Open a pull request using the template; GitHub Actions runs unit tests, the full suite with a coverage gate, and the load test.
5. Squash-merge after review; delete the branch.

## Code style
Plain JavaScript, no build step, no runtime dependencies. Public functions get a doc comment that names the requirement they implement. Never put secrets in the repository.
