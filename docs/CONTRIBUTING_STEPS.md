# How a team member adds their code (step by step)

Three small pieces of code are waiting in the project. Each one has a file for the code and a file of ready-made tests.
Your job: write the code so the tests pass, then send it to GitHub under your own name. Your lecturer can then see
your work on the project page.

| Piece | Who (suggested) | Write your code in | Tests that must pass | What the code does |
|-------|-----------------|--------------------|----------------------|--------------------|
| A | Muhammad Rameel Khan (Up2601145) | `shared/contrib/tags.js` | `tests/contrib/tags.test.js` (8 tests) | Cleans the tags on a project: trim, lower case, no duplicates, at most 8 |
| B | Rana Muhammad Sami Noon (Up2601149) | `shared/contrib/match.js` | `tests/contrib/match.test.js` (8 tests) | Scores 0 to 100 how well a person's skills fit a project's tags |
| C | Ahmad Riaz (Up2601151) | `shared/contrib/relativeTime.js` | `tests/contrib/relativeTime.test.js` (8 tests) | Turns a date into "2 hours ago", "yesterday" and so on |

The names are a suggestion. Swap them if the team agrees on something else. Do not take a piece that is not yours.

The rules for each piece are written at the top of its code file. The tests check every rule, so read the tests first.

## Step 1. One-time setup (about 10 minutes)

1. The team leader opens the repository on GitHub: **Settings, Collaborators, Add people**, and adds your GitHub name.
2. You accept the email invite.
3. Install Node.js 22 or newer and Git. Check: `node -v` and `git --version`.
4. Tell Git who you are. Use the **same email as your GitHub account**, so your commit shows your face and name:

```powershell
git config --global user.name "Your Full Name"
git config --global user.email "your-github-email@example.com"
```

## Step 2. Get the project

```powershell
cd $HOME\Desktop
git clone https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform.git
cd research-collaboration-mentorship-platform
git checkout feature/final-website
git pull
npm ci
```

## Step 3. Make your own branch

Use your piece letter and your name. Example for piece A:

```powershell
git checkout -b feature/contrib-a-tags-rameel
```

## Step 4. Write your code

1. Open your code file (see the table). Write your name and student number on the `Owner:` line.
2. Delete the `throw new Error(...)` line and write the function. Keep the `module.exports` line.
3. Open your test file. Change `describe.skip` to `describe` (one word, near the top).
4. Run only the contribution tests:

```powershell
npm run contrib
```

5. Fix your code until every test of your file shows a green tick. The other pieces stay "skipped"; that is normal.
6. Check the style rules:

```powershell
npm run lint
```

It must show 0 errors.

Hints are in the comment at the top of each code file. If a test fails, the message names the rule. You may ask
the team, but write your own code.

## Step 5. Save and send your work

```powershell
git add shared/contrib tests/contrib
git status --short
git commit -m "feat(contrib): add normaliseTags with 8 passing tests (#2)"
git push -u origin feature/contrib-a-tags-rameel
```

Use your own piece in the message: `matchScore` for B, `relativeTime` for C.

## Step 6. Open the pull request

1. Open the repository on GitHub. Click **Compare & pull request** on the yellow bar.
2. Set **base** to `feature/final-website` (not `main`) and **compare** to your branch.
3. Title: `feat(contrib): <your function>`. Write two lines: what you built and the result of `npm run contrib`.
4. Click **Create pull request**. Wait for the green ticks (about 15 minutes).
5. Ask the team leader to review. The leader merges it (squash or merge commit). Your commit stays under your own name, because you opened the pull request.

## Step 7. Keep the proof (evidence links)

Copy these three links into `docs/EVIDENCE.md` (the leader can do this for you):

1. Your pull request page.
2. Your commits: `https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/commits/feature/final-website?author=YOUR_GITHUB_NAME`
3. Who wrote each line of your file (GitHub "blame"): `https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/blame/feature/final-website/shared/contrib/tags.js` (change the file name for B and C).

The contributors graph is here: `https://github.com/ShaheerHabib12/research-collaboration-mentorship-platform/graphs/contributors`

## Step 8. Leader: close the contribution round (after all pieces are merged)

Do these in one commit, so code and documents stay the same:

1. In `package.json`, remove `"<rootDir>/tests/contrib/"` from `testPathIgnorePatterns` and `"!shared/contrib/**"` from `collectCoverageFrom`. The 24 tests now run in `npm test` and their code counts in the coverage figure.
2. Run `npm run report` and `npm run docs`.
3. Update the test totals in `README.md`, `docs/TEST_PLAN.md`, the report and the guide (search for `224`).
4. Fill the status table in `docs/EVIDENCE.md` with the real links.
5. Push, wait for green, then merge pull request #2.

## If something goes wrong

| Problem | Fix |
|---------|-----|
| `npm run contrib` says tests are skipped | You did not change `describe.skip` to `describe` in your test file |
| A test fails with "is not written yet" | You still have the `throw new Error(...)` line in your function |
| GitHub says "permission denied" | You were not added as a collaborator, or you did not accept the invite |
| Your commit shows a grey avatar | Your Git email is not your GitHub email. Fix it with the `git config` lines in Step 1, then commit again |
| The pull request goes to `main` | Click **Edit** next to the title and change the base to `feature/final-website` |
