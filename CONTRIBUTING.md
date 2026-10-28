# Contributing

These rules keep the repository traceable to the requirements in the coursework report.

## Branches

- `main` is always working. Nobody pushes to it directly.
- Create a branch for every change, named by type:
  - `feature/<short-name>` for new functionality, for example `feature/uc01-create-project`
  - `fix/<short-name>` for bug fixes
  - `docs/<short-name>` for documentation only

## Commits

Use conventional commit messages and mention the requirement ID where there is one:

```
feat(c4): create project brief endpoint (FR-007)
fix(c2): reject expired JWT with 401 (NFR-001)
docs: update architecture notes
test(c6): add 403 case for non-member upload (UC-04)
chore: bump dependencies
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.

## Pull requests

1. Push your branch and open a pull request into `main` using the template.
2. CI must pass (lint, tests, client build).
3. At least one team member who is not the author reviews and approves.
4. Squash or merge only when the checklist in the template is complete.

## Issues and planning

- One issue per user story or defect. Use the issue templates and put the requirement IDs (UR, FR, NFR, UC) in the form.
- Labels: area (`client`, `server`, `database`, `docs`, `ci`) and MoSCoW priority (`must`, `should`, `could`, `wont`).
- Milestones: `Iteration 1`, `Iteration 2`.
- Project board columns: Backlog, In Progress, In Review, Done.

## Code rules

- Never commit `.env`, keys or uploaded files. Use `.env.example` for new settings.
- Database access uses parameterised queries only.
- Every endpoint that changes data has a test for success and for the main failure cases in the matching use case.
- Run `npm run lint` and `npm test` in the folder you changed before pushing.
