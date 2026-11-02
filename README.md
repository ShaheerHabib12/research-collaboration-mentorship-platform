<div align="center">

# Research Collaboration and Mentorship Platform

**Connect researchers. Build teams. Move ideas forward.**

A web platform concept designed to help students and researchers discover collaborators, connect with mentors, organise research projects, and coordinate teamwork in one place.

[![CI](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/actions/workflows/ci.yml)
[![University of Portsmouth](https://img.shields.io/badge/University%20of-Portsmouth-005EB8)](https://www.port.ac.uk/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-4169E1)](https://www.postgresql.org/)
[![Status](https://img.shields.io/badge/Status-Development-orange)](#project-status)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Project Goals](#project-goals)
- [Planned Capabilities](#planned-capabilities)
- [Architecture](#architecture)
- [Database](#database)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Available Commands](#available-commands)
- [Testing and Continuous Integration](#testing-and-continuous-integration)
- [Development Workflow](#development-workflow)
- [Team](#team)
- [Project Status](#project-status)
- [Documentation](#documentation)
- [Security Notes](#security-notes)
- [Licence](#licence)

## Overview

The **Research Collaboration and Mentorship Platform** is a university software engineering project focused on making academic collaboration easier to organise. The platform is intended to support students and researchers as they find collaborators, define responsibilities, request mentorship, and coordinate private project work.

The project is being developed for **M35376: Software Engineering Theory and Practice**, University of Portsmouth, **Team 02, Iteration 1**.

> **Current status:** This repository contains the project scaffold, configuration, architecture notes, a starter database schema with automated tests, and the CI setup. The full set of platform features is not yet implemented. Capabilities described below represent the intended direction of the project and should not be read as completed functionality.

## Project Goals

- Make it easier for students and researchers to discover potential collaborators.
- Support clear agreement on project roles, tasks, and responsibilities.
- Provide a structured way to request and organise mentorship.
- Give project teams a central workspace for coordination and files.
- Encourage maintainable, secure, and testable software development.
- Use version control, code review, and continuous integration throughout development.

## Planned Capabilities

| Area | Intended purpose |
|---|---|
| User profiles | Present research interests, skills, and academic profiles. |
| Projects and collaboration | Create research projects and find or invite collaborators. |
| Responsibilities | Agree on team roles and project responsibilities. |
| Mentorship | Discover mentors and manage mentorship requests. |
| Workspace and files | Coordinate project work and manage project documents. |
| Notifications and moderation | Support project updates, notifications, and platform oversight. |
| Subscriptions and compensation | Represent the proposed subscription and paid-support model. |

These are planned capability areas. Their availability depends on implementation and testing progress.

## Architecture

The project uses a **three-layer client-server modular monolith** design: a React client communicates with a Node.js and Express application, which accesses PostgreSQL and file storage.

| Layer | Components | Responsibility |
|---|---|---|
| Presentation | **C1**: React web client (Vite) | User interface and interaction with the backend API. |
| Application / logic | **C2** API gateway and authentication; **C3** users and profiles; **C4** projects and collaboration; **C5** mentorship; **C6** workspace and files; **C7** notifications and moderation; **C10** subscriptions and compensation | API endpoints and application rules, organised into logical modules within one backend application. |
| Data and storage | **C8**: PostgreSQL; **C9**: encrypted file storage | Persistent relational data and the planned storage of files up to 10 MB. |

For the current architecture notes, see [`docs/architecture.md`](docs/architecture.md).

## Database

The starter schema lives in [`server/db/init.sql`](server/db/init.sql) and is loaded automatically by Docker Compose the first time the database starts. It is safe to run more than once.

| Table | Purpose |
|---|---|
| `users` | Accounts, salted password hashes, and platform role (`user` or `administrator`). |
| `projects` | Research project briefs: owner, title, research question, stage, visibility, status. |
| `workspace_members` | Which users belong to which project workspace, and their role (`owner`, `member`, `mentor`). |
| `tasks` | Workspace tasks with database-level rules: title 3 to 20 characters, optional description up to 250 characters, at most three tags. |

These rules come from requirements FR-042 to FR-044 and are checked by `server/tests/schema.test.js`. More detail is in [`docs/database-schema.md`](docs/database-schema.md).

> Docker only runs `init.sql` when the database volume is created for the first time. After changing the schema, reset the local database with `docker compose down -v` and then `docker compose up -d`. This deletes local data.

## Technology Stack

| Technology | Intended use |
|---|---|
| Node.js 24 | JavaScript runtime for the backend |
| Express 5 | Backend API |
| React and Vite | Frontend application and development server |
| PostgreSQL 16 | Relational database |
| `pg` | PostgreSQL client for Node.js |
| `jsonwebtoken` | JWT-based authentication support |
| `bcrypt` | Password-hashing support |
| `helmet` and `cors` | HTTP security headers and cross-origin configuration |
| Jest and Supertest | Backend testing |
| Vitest and Testing Library | Frontend testing |
| ESLint | Static analysis and code-quality checks |
| GitHub Actions | Continuous integration workflow |
| Docker Compose | Local supporting services, including PostgreSQL |

Actual functionality and readiness depend on implementation, configuration, and successful tests.

## Repository Structure

```text
research-collaboration-mentorship-platform/
├── .github/
│   ├── ISSUE_TEMPLATE/          # Issue templates
│   ├── workflows/               # GitHub Actions workflows (ci.yml)
│   └── pull_request_template.md
├── client/                      # React + Vite frontend
│   └── src/                     # Frontend source and tests
├── server/
│   ├── db/                      # Database schema (init.sql)
│   ├── src/                     # Express app and database access
│   └── tests/                   # Backend tests (API and schema)
├── docs/                        # Architecture and database documentation
├── scripts/                     # Project utility scripts
├── .editorconfig
├── .gitattributes
├── .gitignore
├── CONTRIBUTING.md
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- [Node.js 24](https://nodejs.org/) and npm
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional, for running PostgreSQL through Docker Compose)

Check your installed versions:

```bash
node --version
npm --version
git --version
```

### 1. Clone the repository

```bash
git clone https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform.git
cd research-collaboration-mentorship-platform
```

### 2. Start the database

From the repository root:

```bash
docker compose up -d
```

If you are not using Docker, create a local PostgreSQL database that matches `DATABASE_URL` in `server/.env`, then run `server/db/init.sql` against it.

### 3. Configure and run the backend

```bash
cd server
```

Create a local environment file.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

Open `server/.env` and update its values for your local environment. Do not use production credentials in local development.

Install the dependencies and start the development server:

```bash
npm install
npm run dev
```

The health endpoint is at <http://localhost:3000/api/health>. It works only if the backend starts successfully and its configuration is valid.

### 4. Configure and run the frontend

Open a **second terminal** at the repository root, then run:

```bash
cd client
npm install
npm run dev
```

Vite shows the local URL in the terminal, normally <http://localhost:5173>. Keep both terminals running while you use the application.

### 5. Stop local services

```bash
docker compose down
```

This stops the Compose services. It does not delete the database volume. Add `-v` only if you want to delete local data.

## Configuration

Backend configuration is managed through `server/.env`. The tracked `server/.env.example` file documents the variable names and example placeholders.

1. Copy `.env.example` to `.env`.
2. Read the variable names and comments in the example file.
3. Set values appropriate for your local PostgreSQL instance and application.
4. Keep `.env` out of commits.
5. Never place passwords, access tokens, private keys, or production secrets in source code or documentation.

A placeholder value is not a secure or working configuration. Check the environment example and the backend configuration code.

## Available Commands

Run each command from the directory shown.

| Directory | Command | Purpose |
|---|---|---|
| `server/` | `npm install` | Install backend dependencies |
| `server/` | `npm run dev` | Start the backend in development mode |
| `server/` | `npm test` | Run backend tests (schema tests run when `DATABASE_URL` is set) |
| `server/` | `npm run lint` | Check backend code with ESLint |
| `client/` | `npm install` | Install frontend dependencies |
| `client/` | `npm run dev` | Start the Vite development server |
| `client/` | `npm test` | Run frontend tests |
| `client/` | `npm run lint` | Check frontend code with ESLint |
| `client/` | `npm run build` | Build the frontend for production |

If a command is unavailable, check the `scripts` section of the relevant `package.json`.

## Testing and Continuous Integration

Every pull request, and every push to `main`, runs the GitHub Actions workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **Server job:** starts a PostgreSQL 16 service, then runs `npm ci`, `npm run lint` and `npm test`. The tests include the API health check and the database schema checks (task title length, tag limit, description length).
- **Client job:** runs `npm ci`, `npm run lint`, `npm test` and `npm run build`.

To run the schema tests on your own machine, start the database and set `DATABASE_URL` before testing.

**Windows PowerShell:**

```powershell
docker compose up -d
cd server
$env:DATABASE_URL = "postgres://rcmp_user:change_me@localhost:5432/rcmp"
npm test
```

**macOS / Linux:**

```bash
docker compose up -d
cd server
DATABASE_URL=postgres://rcmp_user:change_me@localhost:5432/rcmp npm test
```

Without `DATABASE_URL`, the schema tests are skipped and the other tests still run. The schema tests use transactions that are rolled back, so they leave no data behind.

## Development Workflow

The team uses Git and GitHub to track work and review changes.

1. **Update `main`:** start from the latest version of the main branch.
2. **Create a feature branch:** use a short, descriptive branch name.
3. **Make focused changes:** keep each change related to a clear task.
4. **Test your changes:** run the relevant tests, lint checks, and the frontend build.
5. **Commit your work:** use a meaningful commit message.
6. **Push the branch:** publish it to GitHub.
7. **Open a pull request:** describe the changes and link the related issue.
8. **Request review:** ask another team member to review the work before merging.

Example commands:

```bash
git switch main
git pull
git switch -c feature/short-description
```

After making and testing changes:

```bash
git add .
git commit -m "Describe the change"
git push -u origin feature/short-description
```

Then open a pull request on GitHub. Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) for the detailed branch, commit, and review rules.

## Team

| No. | Name | GitHub username | Role |
|---|---|---|---|
| 1 | Muhammad Shaheer Habib | [@ShaheerHabib12](https://github.com/ShaheerHabib12) | **Team Leader** |
| 2 | Rana Muhammad Sami Noon | [@Saminoon](https://github.com/Saminoon) | Team Member |
| 3 | Muhammad Rameel Khan | [@mrameelkhan](https://github.com/mrameelkhan) | Team Member |
| 4 | Ahmad Riaz | [@AhmadRiaz99](https://github.com/AhmadRiaz99) | Team Member |
| 5 | Hafiz Muhammad Abu Hurraira | [@AbuHurraira2424](https://github.com/AbuHurraira2424) | Team Member |

## Project Status

**Current stage: Iteration 1, scaffold plus starter database.**

The repository includes the frontend and backend structure, project documentation, configuration examples, a starter PostgreSQL schema (users, projects, workspace members, tasks) with automated constraint tests, and a CI workflow that runs lint, tests and the frontend build.

The complete platform is still under development. Do not assume that all planned capabilities, authentication flows, database operations, file-storage controls, or subscription features are production-ready. Use the repository's issues, pull requests, tests, and coursework documentation to track progress.

## Documentation

- [Architecture](docs/architecture.md): current architecture notes
- [Database schema](docs/database-schema.md): tables, rules, and the requirements they support
- [Contributing guidelines](CONTRIBUTING.md): branch, commit, and review workflow
- [GitHub repository](https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform): source code, issues, pull requests, and CI results

## Security Notes

- Never commit `.env` files, passwords, API keys, access tokens, private keys, or personal data.
- Keep local secrets out of issue descriptions, pull requests, screenshots, and logs.
- Review changes before committing and pushing them.
- Report security concerns privately to the repository owner rather than publishing exploit details in a public issue.
- Treat the current scaffold as a development project, not a production-ready service.

## Licence

This is a university coursework project for educational purposes. No open-source licence has been granted. All rights are reserved by the authors unless the team agrees otherwise.
