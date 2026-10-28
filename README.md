# Research Collaboration and Mentorship Platform

A web platform that helps students and researchers find collaborators and mentors, agree team responsibilities, coordinate private project work, and access research support through subscriptions.

Coursework for **M35376 Software Engineering Theory and Practice**, University of Portsmouth (Team 02, Iteration 1).

> Status: project skeleton. The architecture, requirements and use cases are described in the coursework report.

## Architecture in one minute

A three-layer client–server modular monolith (one deployable Node.js + Express application):

| Layer | What it contains |
|---|---|
| Presentation | C1 React web client (Vite) |
| Application / logic | C2 API gateway and authentication (JWT, role checks, input validation); C3 user and profile; C4 project and collaboration; C5 mentorship; C6 workspace and files; C7 notifications and moderation; C10 subscription and compensation |
| Data and storage | C8 PostgreSQL; C9 encrypted file storage (files up to 10 MB) |

More detail is in [docs/architecture.md](docs/architecture.md).

## Tech stack

- Node.js 24 (LTS line), Express 5, `pg`, `jsonwebtoken`, `bcrypt`, `helmet`, `cors`
- React with Vite
- PostgreSQL 16
- Jest and Supertest (API tests), Vitest and Testing Library (client tests), ESLint
- GitHub Actions for continuous integration

## Getting started

Requirements: Node.js 24, npm, Git, and Docker (optional, for PostgreSQL).

```bash
# 1. Clone
git clone https://github.com/<owner>/<repo-name>.git
cd <repo-name>

# 2. Start PostgreSQL (optional but needed once the database is used)
docker compose up -d

# 3. Server
cd server
cp .env.example .env        # then edit the values
npm install
npm run dev                 # http://localhost:3000/api/health

# 4. Client (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

## Useful commands

| Where | Command | Purpose |
|---|---|---|
| `server/` | `npm test` | Run API tests |
| `server/` | `npm run lint` | Lint server code |
| `client/` | `npm test` | Run client tests |
| `client/` | `npm run lint` | Lint client code |
| `client/` | `npm run build` | Production build |

## Project layout

```
client/   React web client (C1)
server/   Express application (C2 to C7, C10) and database access (C8)
docs/     Architecture notes and project documents
.github/  CI workflow, issue templates, pull request template
```

## Working on the project

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the branch, commit and review rules. Every change goes through a pull request that passes CI and is reviewed by someone other than the author.

## Team

| Name | GitHub username |
|---|---|
| (add name) | (add username) |
| (add name) | (add username) |
| (add name) | (add username) |
| (add name) | (add username) |
| (add name) | (add username) |

## Licence

Coursework project. No open-source licence has been granted; all rights reserved by the authors unless the team decides otherwise.
