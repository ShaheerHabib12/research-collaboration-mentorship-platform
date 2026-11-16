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
| 15 Nov 2026 | `109ec2c` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43696013972 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43696017013 | **All 12 checks green** on both runs (k6 p95 11.3 ms; ZAP 0 FAIL, 0 WARN, 66 PASS; WebKit and Firefox passed). This was the first fully green run |
| 15 Nov 2026 | `717589c` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43700026096 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43700030380 | Adds piece D for Hafiz and the member guides. All green |
| 15 Nov 2026 | `a815503` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43735540264 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43735641903 | **All 12 checks green** after all four member pull requests (#3 to #6) were merged. This is the run to cite as the green run |
| 15 Nov 2026 | `58e8a9c` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43738852513 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43738860711 | **All 12 checks green.** Closing commit: the 32 member tests join the main suite (256 tests, 24 suites) |
| 15 Nov 2026 | `ae52cc1` | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43740863257 | (merge to `main`, push run only) | Pull request #2 merged into `main` with a merge commit; all jobs green. **This is the final run** |

Release tag: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/releases/tag/v1.0-cw2 (`v1.0-cw2`, on `ae52cc1`). Branch protection: ruleset `protect-main` on `main` (pull request required, force pushes and deletion blocked). Repository figures on 15 November 2026, `main` after pull request #2: 26 commits, 5 contributors, 7 branches, 6 merged pull requests, 0 closed issues.

The two failing jobs of the `c6654e9` push run, for the record:
WebKit https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43637039995/job/132575997244
and ZAP https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/runs/43637039995/job/132578201577

To list the newest run links from your computer:

```powershell
gh run list --branch feature/final-website --limit 4 --json url,conclusion,event,headSha
```

## 3. Team contributions

Each member's piece (A, B, C, D) is a function with ready-made tests (see `docs/CONTRIBUTING_STEPS.md`). Each was committed under the member's own GitHub account and merged by its own pull request.

| Piece | Member | GitHub name | Pull request | Commits by this member | Who wrote the file (blame) |
|-------|--------|-------------|--------------|------------------------|----------------------------|
| A `normaliseTags` | Muhammad Rameel Khan (Up2601145) | [@mrameelkhan](https://github.com/mrameelkhan) | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/pull/3 | [427e885](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commit/427e885); all by this member: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commits/feature/final-website?author=mrameelkhan | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/tags.js |
| B `matchScore` | Rana Muhammad Sami Noon (Up2601149) | [@Saminoon](https://github.com/Saminoon) | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/pull/4 | [c19bb11](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commit/c19bb11); all by this member: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commits/feature/final-website?author=Saminoon | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/match.js |
| C `relativeTime` | Ahmad Riaz (Up2601151) | [@AhmadRiaz99](https://github.com/AhmadRiaz99) | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/pull/5 | [2e8e549](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commit/2e8e549); all by this member: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commits/feature/final-website?author=AhmadRiaz99 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/relativeTime.js |
| D `formatFileSize` | Hafiz Muhammad Abu Hurraira (Up2601139) | [@AbuHurraira2424](https://github.com/AbuHurraira2424) | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/pull/6 | [2ffd950](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commit/2ffd950); all by this member: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commits/feature/final-website?author=AbuHurraira2424 | https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/fileSize.js |

Contributors graph: https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/graphs/contributors (GitHub counts a person here once the commits are on `main`, so the graph fills in after pull request #2 is merged; until then the pull request pages and the commit links above are the proof).

## 3b. Real e-mail on the live site

On 16 November 2026 the live site (https://rcmp-team02.me) sent a real sign-up PIN and a real password-reset e-mail through Brevo to a Gmail inbox. The new account was created with the PIN and then signed in with the reset password. Nine screenshots and a short index are in [`docs/evidence/email/`](evidence/email/README.md). This is a manual check, not an automated test. Setup steps: [`docs/EMAIL_SETUP.md`](EMAIL_SETUP.md).

## 4. Local evidence files (inside the repository)

| File | What it holds |
|------|---------------|
| `docs/evidence/TEST_REPORT.txt` | Every test with PASS or FAIL and its time |
| `docs/evidence/COVERAGE_REPORT.txt` | Coverage for every server and shared file |
| `docs/evidence/mutation/index.html` | Mutation testing report |
| `docs/screenshots/` | Screens of the running site |
| `docs/evidence/email/` | Nine screenshots of the real sign-up PIN and password-reset e-mails (16 November 2026) |
