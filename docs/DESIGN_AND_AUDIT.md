# Design decisions and self-audit

## 1. Which style fits this product?

The users are university students, researchers and mentors who work for long sessions on dense, serious material (agreements, statements, files). The report's non-functional requirements stress trust, privacy and accessibility.

| Option | For | Against | Verdict |
|---|---|---|---|
| **Calm, structured, minimal (chosen)** | Reads as credible and academic; keeps attention on content; easy to make accessible | Can feel plain if colour is not used with care | Chosen, with one confident accent (sapphire) plus teal/amber for meaning |
| Playful / colourful | Friendly for first-year students | Undermines trust for money, agreements and privacy; harder to keep contrast | Rejected |
| Dark, dense "developer tool" | Good for power users | Many users are non-technical; poor for first impressions in a demo | Offered only as a possible later theme |
| Heavy illustration / marketing | Strong landing page | Slows pages, adds little to tasks | Limited to the landing page |

**Therefore:** the "Academic Nexus" system from the Stitch reference - sapphire `#2563EB`, navy text, teal for positive/active, amber for caution, slate neutrals; Plus Jakarta Sans for headings, Inter for text, JetBrains Mono for IDs and money; 4 px radius and hairline borders; 260 px sidebar and 64 px top bar for app pages.

## 2. Component decisions

| Element | Choice | Reason |
|---|---|---|
| Page loading | **Skeleton blocks** shaped like the content | Avoids layout jump; feels faster than a spinner on lists and cards |
| Button in progress | Label changes ("Saving…") and the button is disabled | Prevents double submission, which matters for payments and transitions |
| Long operations | Inline status + toast, never a blocking full-page spinner | The user keeps context |
| Buttons | Solid primary (one per view), outlined secondary, red outlined only for destructive actions; 40 px height, visible focus ring | Clear hierarchy; touch-friendly; keyboard-visible |
| Feedback | Toasts (`aria-live`) for success/warning; inline field errors for validation; modal confirm only for irreversible actions | Matches NFR-010 (report successes and problems clearly) |
| Errors | Each status has its own wording (401 / 402 / 403 / 409 / 413 / 500 / offline) | The spec defines these cases, and the demo shows them |
| Forms | Visible labels, character counters, limits shown before the user hits them | Title 3-20, description 250, 3 tags, 10 MB |
| Empty states | Say what is missing and what to do next | Avoids blank screens |
| Landing and login | Short value statement, three role-based entry points, one-click demo accounts | Gets a marker into the product in one click |
| Responsive | Breakpoints at 1279 / 1023 / 767 px; sidebar becomes a drawer on small screens | Checked at 1440 and 390 px |

Established guidance behind these choices: Nielsen's usability heuristics (visibility of status, error prevention, recognition over recall) and WCAG 2.2 AA (contrast, focus visibility, labels, target size). *No fresh web research was done for this round; the choices rest on those well-known guidelines and the Stitch reference supplied.*

## 3. Self-audit of the first front end

Method: review of every page against the report's use cases and the brief's "well-designed interface" criterion; scripted browser run (Playwright) as each of the four roles at 1440 px and 390 px, capturing console errors, page errors, horizontal overflow and visible raw markup; screenshots inspected.

**Found and fixed**

| Problem | Effect | Fix |
|---|---|---|
| Strings containing HTML were escaped inside the template tag | Compensation and support pages printed literal `<th>` / `<div>` text | Wrapped static markup in `raw()`; the checker now fails any page that shows escaped tags |
| Login, workspace and tables overflowed at 390 px | Horizontal scrolling on phones | `min-width: 0` on grid children, wrapping buttons, `position: relative` on table wrappers |
| *Demo tools* button covered the user card | Hid sign-out | Moved to bottom-right |
| Workspace / agreement opened blank without `?id=` | Looked broken when reached from the sidebar | Defaults to the user's first project |
| Admins could open private workspaces | Contradicted NFR-001 | Removed; tested (`TC-API-19`) |
| Upload failure produced two toasts | Noisy | One toast from the API result |
| Front end ran on a mock back end | Not a three-tier system | Real API + database; all rules re-checked on the server |

**Still weak (and what would fix it)**

- No automated browser tests in the repository → add Playwright specs from the manual checklist.
- Not audited with an automated accessibility tool (axe) → run it and fix findings.
- Page scripts are inline and dense → move to per-page modules with JSDoc for the "code documentation" criterion.
- Fonts are the system fonts (no outside font service is called, so nothing leaves the page and the CSP allows only this origin).
- React/Vite from the design was not used (see `ARCHITECTURE.md`).


## 5. Second design pass (after the move to a real server)

**What looked like a coursework project, and what changed**
- Requirement codes (FR-/UC-/NFR-) printed on pages and cards, a "3-20 chars" developer badge and "14 chars" on task cards: removed from the interface. Traceability lives in `README.md` and `docs/TEST_PLAN.md`, where reviewers look for it.
- A landing statistics row that wrapped into an uneven stack: now a three-column grid with consistent captions; on phones it stacks cleanly.
- Dashboard summary cards on phones took four screens of scrolling: now two per row.
- The "Demo tools" button covered the last row of content: pages now end with extra bottom space.
- Three screens still said data is "stored in your browser": corrected (and guarded by a test).

**Motion (`client/assets/css/motion.css`, `client/assets/js/motion.js`, `client/assets/js/vt.js`)**

| Where | What | Why |
|---|---|---|
| Page to page | Cross-document View Transitions: only the content cross-fades; sidebar and top bar stay fixed | Navigation feels continuous and the user keeps their place; unsupported browsers just navigate normally |
| Cards and boards | 400 ms staggered rise when data arrives | Shows that something loaded; replaces a hard pop-in after the skeleton |
| Numbers | Count-up on dashboard figures; progress bars fill | Draws the eye to what changed; tabular digits prevent jitter |
| Task board | Lift on hover, tilt while dragging, pulse where a card lands | Direct manipulation needs visible cause and effect |
| Buttons | 150 ms colour change, slight press-down | Confirms the click |
| Landing hero | A calm network of drifting nodes (canvas), pointer gently pushes them; product card tilts a few degrees with the pointer; sections reveal on scroll | Says "collaboration" without stock imagery; paused when off screen or the tab is hidden |
| Everything | Disabled under `prefers-reduced-motion`; only `transform` and `opacity` are animated | Accessibility and performance |

**Why not Three.js?** A 3-D library would add a large external script (blocked by our strict content-security policy unless loosened), cost load time on every visit, and the product has no 3-D content. A 2-D canvas of about 40 nodes is under 3 KB, works offline and matches the subject. If the team later wants a 3-D hero, Three.js can be vendored into `client/assets/js/` and loaded on the landing page only.

**Honest limits.** Motion was reviewed in screenshots and exercised by the browser tests (no console errors, no horizontal scroll at 360/768/1280 px), not by a usability study; see `docs/USER_TESTING.md`. Animation timing is a judgement call that real users may dislike.

### 5.x Help assistant "Scout" (design rationale)

- **Name and character.** "Scout" suggests someone who knows the ground and points the way, which is the job (guide, not oracle). The mascot is drawn for this project (round scholar-bot with a visor and mortarboard); it is not a copy of the reference sites' characters.
- **Colour.** Only existing brand tokens: navy-to-sapphire header and launcher, white panel, slate text, teal for the "online" dot and eyes, one amber accent (antenna, unread dot). No purple/neon gradient, which is the usual "AI product" look.
- **Behaviour requested in the brief.** Three vibrations on hover/keyboard focus (`.shake`, 0.22 s x 3), click opens and a second click closes, Esc closes and returns focus to the launcher. `prefers-reduced-motion` removes the movement.
- **Honesty.** The panel footer states Scout is a guide, not an AI model or an adviser. Off-topic questions get a fixed reply that says it is specific to this platform, plus suggestion chips. Identity questions ("are you ChatGPT?") are answered truthfully.
- **Security.** Answers are rendered with `textContent`; the user's text is never echoed; links are limited to local `*.html`; the endpoint is rate limited and read-only.
- **Limits.** Keyword matching misses unusual wording; no conversation memory beyond the tab (sessionStorage); not usability-tested with real users yet.
