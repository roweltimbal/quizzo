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
| Wed Nov 25 | Added an auto-playing product tour to "/" (LandingSlideshow: 6 slides, per-slide timing, 600 ms crossfade, dots + arrow keys, pauses on hover/focus/hidden tab, no autoplay with reduced motion). Converted the slide PNGs (0.6–1.7 MB) to WebP at 85% (33–100 KB). Checked at 1440 and 390 px. | Pending                                                                                                                      | Pending                                                                                                                      |
| Wed Nov 25 | Moved the original slide PNGs from public/landing/ to docs/assets/slides/ (plain move: they were never committed, so no history to keep). public/landing/ now holds only the 6 WebPs. Test PDFs are in test-pdfs/ (gitignored, not under public/), left as is. Clean build: no .png or .pdf in dist; slides are 364 KB total. "/" still shows the slideshow. | Pending                                                                                                                      | Pending                                                                                                                      |

## Decisions

### D1 2026-11-23 · Decision: removed the Review quiz screen

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

### D2 2026-11-23 · Decision: Client-side PDF extraction + page-range fallback

**Decision:** Read the PDF (outline, page count, chapter text) in the browser
with pdf.js. Only the chapter text goes to the server for the AI call.

**Why:** Simpler than parsing PDFs on Cloudflare Workers, and the server never
handles the full file.

**Tradeoff:** Chapters only come from PDF bookmarks. If there are none, or
they're junk, the user types a page range. Auto-detecting chapters from text
isn't reliable (some chapter titles are images, not text).

### D3 2026-11-23 · Decision: 40-page cap per quiz

**Decision:** A quiz covers at most 40 pages.

**Why:** Keeps the AI input under ~60k characters, generation fast, and
6 questions focused on one chapter.

### D4 2026-11-24 · Decision: Adjusted the prompt for AI response to meet audience's vocabulary and tone

**Decision:** Adjusted the prompt to fit primary school students

**Why:** Using the appropriate vocabulary and tone to increase clarity

### D5 2026-11-24 · Decision: Live rooms on records, not partypack's game-room Durable Object

**Decision:** Build the live room on records (`rooms` / `players` / `answers`,
read with `useQuery`, written by server actions), not on a custom per-room
game Durable Object like partypack's. From partypack, only the room-code
format (4 letters, 24-letter alphabet, no I/O) and the join-by-link route
(`/join/CODE`) were borrowed.

**Why:** partypack's game room broadcasts one game state to every
connection, so the answer is on the wire during a question. Its own code
says a player "using devtools could read the truth early" and that the SDK
has no per-connection redaction hook. Quizzo can't accept that: answers and
`sourceText` must never reach players before grading. Records give
per-record permissions on the server: `quizzes` is unreadable by every
client, a room is readable only by its host and players, and only the host
can change status/index. Records also use current SDK APIs, while
partypack's game room is copied from SDK 0.9.2 (removed in 0.17).

**Tradeoff:** Every answer and host step is a server round trip and a
record write (a few hundred ms), not a ~50 ms game tick, and there is no
server tick for timers (a question timer would be a `questionEndsAt`
timestamp counted down in the browser). For a quiz with one question every
10–30 seconds that latency doesn't matter.

## Quick Logs

### 2026-11-24 Testing: Tested lobby hosting with two accounts - Regression check on solo play

Deployed live room step 1. Regression: solo still works. Verified on quizzo.app.space with two accounts in both directions (laptop hosts / phone joins, phone hosts / laptop joins); players appear live. Also verified upload + solo on mobile.

### 2026-11-25 Game Design Change

Agent's plan included a per-player progress strip from an older spec; removed it, since host-controlled Next keeps everyone on the same question.

### 2026-11-25 Multiplayer: Hosts Next Button Availability Condition Change

Two-account test found the host could skip their own question and force others to skip. Fixed: the host must answer first (enforced server-side); Next waits for everyone, with a confirmed 'Move on anyway' so one absent player can't stall the game.
