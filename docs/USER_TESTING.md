# User validation protocol (NFR-014)

NFR-014 requires core workflows to be tested with representative users, with at least 4 of 5 completing them unaided and all blockers logged. This is a **procedure for the team to carry out**; no sessions have been run and no results are claimed here.

## Setup
- Five participants who match the personas (for example 2 students, 1 researcher, 1 mentor, 1 other). Obtain consent first; do not record names in results (use P1-P5).
- Start with `npm start`, use *Demo tools -> Reset demo data* before each participant.
- Sit beside them, do not help, note where they hesitate. Time-box 20 minutes each.

## Tasks (one use case each)
| # | Role | Task | Success |
|---|---|---|---|
| T1 | Student | Find a project that needs Python and ask to join with a message | Request appears in Requests as pending |
| T2 | Researcher | Accept an incoming request | Request shows accepted; member is on the team |
| T3 | Member | Create a task, attach a file, move the task to Done | Task in Done; file listed |
| T4 | Owner | Publish a team agreement, then another member acknowledges | Acknowledgement shown |
| T5 | Student | Request a mentor, then request researcher support | Both requests listed (or a clear plan-limit message) |
| T6 | Any | Recover access after forgetting the password | Signed in with the new password |

## Record for each participant and task
Completed unaided (yes/no), time taken, errors made, confusing wording, accessibility problems, a 1-5 ease rating, and free comments.

## Reporting
Summarise as: completion rate per task (target >= 4/5), list of blockers with severity, the changes you made because of them, and what you could not fix. Put the table and two or three direct (anonymous) quotes in the report's testing discussion.
