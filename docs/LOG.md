# Build Log

## Work Log

Running record of what the agent did vs. what I verified or changed. Used for the writeup.

| Date       | Agent did                                                                                                                                                                                                                                   | I verified                                                                                                                   | I changed                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sat Nov 21 | Scaffolded the DeepSpace app                                                                                                                                                                                                                | First deploy loads on my phone at quizzo.app.space                                                                           | —                                                                                                                            |
| Sun Nov 22 | Drafted the screen spec from my idea                                                                                                                                                                                                        | Reviewed it against my wireframe                                                                                             | Dropped the quiz review step (it would spoil the answers); moved mode choice to Pick chapter; added Join room on Home        |
| Sun Nov 22 | —                                                                                                                                                                                                                                           | Checked the free tier limits (500 credits, 1 deployment, 1 GiB)                                                              | Cut quiz history/best scores; AI billed to the app owner via DeepSpace proxy; 20 MB upload limit; one app-wide record scope  |
| Sun Nov 22 | —                                                                                                                                                                                                                                           | `deepspace status` shows the app deploys from the DeepSpace repo                                                             | Added the spec instruction to AGENTS.md so the agent reads docs/SPEC.md first                                                |
| Sun Nov 22 | Agent setup design tokens                                                                                                                                                                                                                   | I checked the colors it match DESIGN.md                                                                                      |
| Sun Nov 22 | Agent build uploading pdf(with chapters)                                                                                                                                                                                                    | no-outline, scanned and non-PDF tests deferred to Wednesday                                                                  |
| Sun Nov 22 | Built Upload screen (useR2Files, pdf.js checks before upload, cleanup on failure)                                                                                                                                                           | Uploaded the outlined PDF, reload keeps it, .png rejected; second Google account sees no books (owner-only permissions work) | Outline rule fixed: remove _ entries, then require 2+ chapters (agent's version dropped all chapters if any _ entry existed) |
| Mon Nov 23 | Agent built screen 4 + new junk rule                                                                                                                                                                                                        | It failed on the old rule, then passed                                                                                       | It failed on the old rule, then passed. I checked the selected-row styling and both test books on the live site.             |
| Mon Nov 23 | B was the correct answer in 3/5 multiple choice questions                                                                                                                                                                                   | I checked it, it was indeed the case                                                                                         | Added server side shuffle and promp rule for similar length distractors                                                      |
| Mon Nov 23 | gent's earlier claim (reload doesn't regenerate) was wrong: React Router keeps the request in history, so reloads re-ran generation. It surfaced this when it went over my 1-generation budget. Fixed with a one-time ID in sessionStorage. | I verified: reload on live shows "already started" with no new request in the Network tab.                                   |

## Decisions

### 2026-11-23 · Decision: removed the Review quiz screen

**Decision (mine):** Dropped the pre-play Review screen (old screen 6). The
mode is now chosen on Pick chapter: [Play solo] / [Host room] → Generating → play.

**Why:** The person who creates the quiz usually takes it too (the host plays
in live rooms). A review screen would show them the questions and correct
answers before playing and spoil the quiz.

**Tradeoff:** No human checks the AI's questions before play. Mitigations:

- Zod validation of the AI output (question count, 4 options, one correct
  answer, source page), retry once if it fails
- Every question cites a source page from the chapter
- Multiple choice graded in code, not by AI
- Correct answers + explanations shown on the Result screen, so bad questions
  are visible after play

### 2026-11-23 · Decision: Client-side PDF extraction + page-range fallback

**Decision:** Read the PDF (outline, page count, chapter text) in the browser
with pdf.js. Only the chapter text goes to the server for the AI call.

**Why:** Simpler than parsing PDFs on Cloudflare Workers, and the server never
handles the full file.

**Tradeoff:** Chapters only come from PDF bookmarks. If there are none, or
they're junk, the user types a page range. Auto-detecting chapters from text
isn't reliable (some chapter titles are images, not text).

### 2026-11-23 · Decision: 40-page cap per quiz

**Decision:** A quiz covers at most 40 pages.

**Why:** Keeps the AI input under ~60k characters, generation fast, and
6 questions focused on one chapter.
