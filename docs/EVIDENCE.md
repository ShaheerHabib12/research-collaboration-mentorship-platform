# Evidence links

Every claim in the report points to something a marker can open. This page lists the links. All of them are on GitHub
and open without any file from us. Repository: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform

## 1. Pull request and checks

| What it proves | Link |
|----------------|------|
| The pull request, its commits and its checks | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/pull/2 |
| All checks of the pull request on one page | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/pull/2/checks |
| Every CI run ever made | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions |
| Commit history of the branch | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commits/feature/final-website |

## 2. CI runs, in order

Each run shows the job list, the log of every test and a summary with the run link, commit link and test totals
(step "Evidence links for this run"). The `test-evidence` artifact on the run page holds the full test list and coverage.

| Date | Commit | Run (push) | Run (pull request) | Result and what we did |
|------|--------|------------|--------------------|------------------------|
| 14 Nov 2026 | `6702eb8` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43628553691 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43628559880 | Failed. Flaky Firefox and WebKit tests. Fixed in the next commit |
| 14 Nov 2026 | `30ff8a7` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43631710458 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43631714044 | Failed. Firefox console message read as an object, WebKit scroll test, k6 ran with 1 user instead of 50 |
| 14 Nov 2026 | `c6654e9` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43637039995 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43637044876 | Main job, Cypress, k6 (50 users) and Firefox green. WebKit push run failed (page heading wait of 8 s), ZAP warned "Base64 Disclosure" on the bundled font stylesheet |
| 15 Nov 2026 | `1d0729f` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43640454744 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43640459894 | Pull-request run all green. Push run green except Cypress (one width check on `/notifications` at 1280 px, 15 px too wide while the page settled). Firefox, WebKit, k6 (p95 10.1 ms) and ZAP (0 FAIL, 0 WARN, 66 PASS) passed; 24 contribution tests skipped. Cypress job: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43640454744/job/132586676778 |
| 15 Nov 2026 | `f1b2b17` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43692612215 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43692618955 | Push run fully green (6 of 6 jobs; k6 p95 27 ms; ZAP 0 FAIL, 0 WARN, 66 PASS). Pull-request run green except WebKit TC-E2E-10 (300 s timeout on a slow runner): https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43692618955/job/132746241888 |
| 15 Nov 2026 | next commit | paste link here | paste link here | Fix: each axe run capped at 60 s and tried twice; WebKit and Firefox test limit 900 s; route named in the error |

The two failing jobs of the `c6654e9` push run, for the record:
WebKit https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43637039995/job/132575997244
and ZAP https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43637039995/job/132578201577

To list the newest run links from your computer:

```powershell
gh run list --branch feature/final-website --limit 4 --json url,conclusion,event,headSha
```

## 3. Team contributions

Each member's piece is a function with ready-made tests (see `docs/CONTRIBUTING_STEPS.md`). Fill a row when the piece is merged.

| Piece | Member | GitHub name | Pull request | Commits by this member | Who wrote the file (blame) |
|-------|--------|-------------|--------------|------------------------|----------------------------|
| A `normaliseTags` | Muhammad Rameel Khan (Up2601145) | _to fill_ | _to fill_ | `.../commits/feature/final-website?author=GITHUB_NAME` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/tags.js |
| B `matchScore` | Rana Muhammad Sami Noon (Up2601149) | _to fill_ | _to fill_ | `.../commits/feature/final-website?author=GITHUB_NAME` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/match.js |
| C `relativeTime` | Ahmad Riaz (Up2601151) | _to fill_ | _to fill_ | `.../commits/feature/final-website?author=GITHUB_NAME` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/relativeTime.js |

Contributors graph: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/graphs/contributors

## 4. Local evidence files (inside the repository)

| File | What it holds |
|------|---------------|
| `docs/evidence/TEST_REPORT.txt` | Every test with PASS or FAIL and its time |
| `docs/evidence/COVERAGE_REPORT.txt` | Coverage for every server and shared file |
| `docs/evidence/mutation/index.html` | Mutation testing report |
| `docs/screenshots/` | Screens of the running site |
