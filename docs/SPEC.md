# Quizzo — Screen Spec (v3)

**One-liner:** Turn any book chapter into a quiz, play it solo or live with friends, and get AI grading + feedback.

**Deadline:** Wed Nov 25, 2026, 11:59 PM ET · Deploy target: `quizzo.app.space`

**Guiding rule:** fast and simple. Make the flow work by Wednesday; UI polish goes in the writeup as "next."

**Priority legend:**
- **P0** = must work on the live URL (the "important path")
- **P1** = the standout feature (live room). Ship it if stable by Tue 1pm, otherwise explain it in the writeup as "next"
- **P2** = nice to have

> DeepSpace API names below come from docs.deep.space. Confirm the exact signatures in the linked guide before building each screen. Don't let the agent guess.

---

## Navigation

```
Sign in → Home
Home:  My books · [Upload book] · [Join room]

[Upload book] → Upload → back to Home
Tap a book → Pick chapter → [Play solo]  → Generating → Solo quiz → Grading → Result → Home / Retry
                          → [Host room]  → Generating → Lobby (host) → Live quiz → Live result → Home
[Join room] → enter code → Lobby (player, waiting) → Live quiz → Live result → Home
```

- The mode is chosen **on Pick chapter** (two buttons), so book/chapter selection is built once, not separately for solo and room.
- **No review step:** generated quizzes go straight to play. The person who'd review the quiz is the person taking it, so reviewing would spoil the answers.
- Live room = the **Host room** button + the **Join room** button. Cutting it means hiding two buttons.

---

## Screens

### 1. Sign in — P0
- **Shows:** app name, one-line pitch, "Sign in with Google."
- **DeepSpace:** Auth (`useAuth`, Google OAuth). Guides: `/guides/authentication`, `/guides/google-oauth`
- **Done when:** signed-out users can't reach any other screen.

### 2. Home — P0
- **Shows:** "My books" list (with empty state), buttons **Upload book** and **Join room** (Join room is P1). Tapping a book opens Pick chapter.
- **DeepSpace:** Records (`useQuery`) filtered to the current user.
- **Done when:** a reload shows the same books (data persists).
- **Not in MVP:** a "My quizzes" history list and best scores.

### 3. Upload book — P0
- **Shows:** file picker, Upload button, progress, then back to Home. The new book appears in My books.
- **DeepSpace:** File storage (`/guides/file-uploads`, `/sdk-reference/client/files`)
- **Logic:** after upload, read the PDF's **outline (TOC) and page count** with pdf.js on the client, then save a `books` record.
- **Edge cases:** reject files that aren't PDFs; reject files over **20 MB** (free tier has 1 GiB storage per app); if the PDF is scanned (no text layer), show "This PDF has no selectable text."

### 4. Pick chapter — P0
- **Shows:** a **single-select** chapter list from the outline. Picking a chapter **fills in** the page range. If there's no outline, show only the page-range input. Two buttons: **Play solo** and **Host room** (P1).
- **Logic:** validate start ≤ end, within the page count, and a maximum of about 40 pages.
- **Done when:** a book with an outline and a book without one both work.

### 5. Generating — P0
- **Shows:** "Reading Ch 4: Cell Division…" spinner, then go to Solo quiz or Lobby, depending on the button pressed.
- **DeepSpace:** Server action + AI (`/guides/server-actions`, `/sdk-reference/worker/ai`)
- **AI setup:** `createDeepSpaceAI(env, 'anthropic')` from `deepspace/worker` with **no authToken**, so calls are billed to the app owner (free-tier credits), never to the player. Use with `generateText` from the `ai` package. Model: `claude-haiku-4-5` by default; switch generation to a Sonnet model only if question quality is poor.
- **Logic:**
  1. The client extracts the chapter's text (pdf.js), tagged with page numbers (`[p.87] …`), and sends it to a server action, capped at about 60k characters.
  2. The worker calls Claude and asks for **JSON**: 5 multiple-choice + 1 short-answer question, each with the correct answer, a short explanation, and a source page.
  3. Validate with **Zod**. If it's invalid, retry once, then show an error.
  4. Save the `quizzes` record, including `sourceText` (needed later for grading).
- **Secrets:** there is no AI key in the app. AI is only called from the worker through the DeepSpace proxy; no provider SDKs (`@anthropic-ai/sdk`, etc.) and no keys anywhere in the repo.
- **Answers stay hidden:** the server action returns the questions **without** `answerIndex`, `expectedAnswer`, or `explanation`. Correct answers only reach the client with the grading results.

### 6. (Removed) Review quiz
The quiz-taker would see the answers. Quality control instead comes from: Zod schema validation, a source page on every question, and multiple choice graded in code.

### 7. Solo quiz — P0
- **Shows:** progress bar + "1/6", one question per screen, **Next** (Back optional), **Submit** on the last question. The short-answer question has a text box.
- **Logic:** keep answers in local state; on Submit, send `{ quizId, responses }` to the grading server action and show Grading. Nothing is saved for solo play.

### 8. Lobby — P1 (shared by host and players)
- **Host sees:** big room code (e.g. `KMTR`) with tap to copy, a "Copy invite link" button, list of joined players appearing live, **Start** button.
- **Player sees:** the same code + player list, "Waiting for host to start…"
- **DeepSpace:** Records + Rooms (`RecordRoom`, `/sdk-reference/worker/rooms`), real-time sync, presence (`/guides/presence-and-cursors`), permissions (only the host can change room status).
- **Logic:** the code is generated **server-side when the host taps Host room** (the `hostRoom` server action). Room status: `lobby`.
- **Room codes:** 4 letters from a 24-letter alphabet with no `I` or `O` (so they can't be misread as 1 or 0), about 331k codes, unique among open rooms (`lobby` / `question`). Format borrowed from partypack; see the Decisions in docs/LOG.md.

### 9. Join room — P1
- **Shows:** a code input and **Join** (opened from Home). Errors for "Room not found" and "Game already started."
- **Invite link:** `/join/<CODE>` joins directly (signed-out visitors sign in first and come back to the link).
- **Logic:** the `joinRoom` server action looks up the room by code, adds the caller as a player (`players` record + the room's player list), and opens the Lobby. Rejoining a room you're already in just reopens it.

### 10. Live quiz — P1 (the DeepSpace showcase)
- **Everyone sees:** "Question 2/6" with the progress bar, "3/4 answered", the current question, answer buttons, and "Answer locked" after submitting. No per-player progress strip: the host controls Next, so everyone is always on the same question.
- **Host only:** **Next**, or **See results** on the last question. Players have **no** Next button; once locked they see "Waiting for the host…".
  - The host plays too: Next / See results appears only after the host submits their own answer. `advanceRoom` refuses to close a question the host hasn't answered, even with `force`.
  - Next / See results stays disabled until every player has answered. Before that the host gets a secondary **Move on anyway** button with a confirm: "N players haven't answered. They'll get 0 for this question." `advanceRoom` refuses to close a question with missing answers unless the request has `force: true`.
- **DeepSpace:** real-time sync of the room record (`status`, `currentIndex`, `answered`, `leaderboard`) and the player's own `answers` records.
- **Logic:** the host moves the game on through the `advanceRoom` server action (start / next / results), which checks the caller is the host. Rooms are read-only for every client, because closing a question has to grade it at the same moment, and a direct record edit can't do that. Players lock answers through `submitAnswer`. **An answer is graded when the host closes the question, not when it's submitted**, so while a question is open nothing correct/incorrect exists anywhere, not even in the player's own row.
- **Refresh:** returns to the current question; the player's own answer row brings their answer back locked.
- **Not built:** timer, late joiners (joining needs the lobby), players leaving mid-game.

### 11. Grading — P0
- **Shows:** a short "Grading your answers…" state (can be part of the Result screen). Multiple-choice results appear instantly; the short-answer result fills in when the AI responds.
- **DeepSpace:** Server action + AI (same `createDeepSpaceAI` setup, `claude-haiku-4-5`).
- **Logic:** the server loads the quiz record (answers + `sourceText`). **Multiple choice is graded in code, not by AI.** For the short answer, send the question, the expected answer, the student's answer, and `sourceText` to Claude, and get back JSON `{score 0–1, feedback, page}` (Zod-validated).
- **Solo:** the server action returns the full results (per-question ✓/✗, correct answer, explanation, short-answer feedback) directly. Nothing is stored.
- **Live room:** results are written to the player's `answers` records so the leaderboard updates live. Only the server can write `isCorrect`, `score`, and `feedback`. Multiple choice is graded in code by `advanceRoom` when the host closes each question. Short answers are graded by a background job (`grade-room-short-answers`, queued at See results; up to 3 attempts; already-graded rows are skipped), with the same grader, prompt, 0.5 threshold and feedback cleanup as solo. If the job can't be queued, `advanceRoom` grades inline. If the AI fails both attempts: "Couldn't grade this one", counted as 0.

### 12. Result — P0 (leaderboard is P1)
- **Shows:** "Quiz complete! You scored…", Correct / Incorrect counts, then each question with ✓/✗, the correct answer, and the AI feedback (with page number).
- **Live room only:** leaderboard at the top (book + chapter title, ranked players; ties share a rank) that updates as grading finishes, with "grading…" next to scores still waiting. Then the player's own review, with correct answers from the room's `answerKey` (published only at results). **Create another quiz** only, no Retry.
- **Names (live):** first names; players who share one get a last initial ("Rowel T.") or, if that clashes too, a number ("Rowel 2"). Only the label is stored.
- **Solo:** no leaderboard.
- **Buttons:** **Create another quiz** (→ Home), Retry (solo; replays the same quiz from memory, no new AI generation). Share results is P2.

---

## Data model (records)

**Scope:** one app-wide record scope, `<RecordScope roomId={SCOPE_ID}>`, where `SCOPE_ID` is `app:<DEEPSPACE_APP_ID>` (see `src/constants.ts`; the app ID comes from `wrangler.toml`, so each environment gets its own scope). Don't hard-code `app:quizzo`. All collections live in that one Durable Object. (Per-game scopes are a "next" item, not MVP.)

**Users:** handled by DeepSpace auth. No `users` collection; store the auth user ID as `ownerId` / `userId`.

**Files:** PDFs live in DeepSpace file storage; the `books` record holds the `fileId`.

| Collection | Key fields | Permissions |
|---|---|---|
| `books` | ownerId, title, fileId, pageCount, outline[] (title + startPage) | owner read/write |
| `quizzes` | ownerId, bookId, chapterTitle, pageStart, pageEnd, sourceText, questions[] (incl. answers) | server writes; answers/`sourceText` never sent to players before grading |
| `rooms` (P1) | code, quizId, hostId, status (lobby/question/results), currentIndex, title, bookTitle, questions[] (**answer-stripped**: prompt, choices, page), playerIds[], players[] (userId + display label), answered (who answered the current question, ids only), leaderboard[], answerKey (null until results) | readable only by the host and joined players; **read-only for every client**: created by `hostRoom`, players added by `joinRoom`, game moved by `advanceRoom` (**host only**, checked in the action) |
| `players` (P1) | roomId, userId, displayName (first name only) | written only by `hostRoom` / `joinRoom` with the caller's own id (a user adds only themselves); each user reads only their own rows |
| `answers` (P1, live rooms only) | roomId, userId, questionIndex, response, graded, isCorrect, score, feedback, page (unique per room + user + question) | created by `submitAnswer` with the caller's own id; graded only by `advanceRoom` and the grading job; no client can create, change or delete; each player reads only their own rows |

- **Players get questions from the room, not the quiz.** `hostRoom` copies the answer-stripped questions onto the room; `quizzes` stays unreadable by every client.
- **No answer leaks during a question (step 2).** While `status` is `question`, players see only counts ("3/4 answered"), never other players' `response` / `isCorrect`. Responses and results become visible once the question closes, for the leaderboard.
- **Live grading (step 2).** `gradeQuiz` only grades the quiz owner's solo play. Live rooms use a separate `submitAnswer` action that checks the caller is in the room, the room is on that question, and one answer per player per question.
- **Not in MVP:** `attempts` / saved solo results.

---

## Build order
1. **Screens 1–4:** auth, home, upload + outline parsing, chapter picker
2. **Screens 5, 7, 11, 12:** generation → solo quiz → grading → result. **P0 path complete; deploy.**
3. **Screens 8–10:** lobby + join + live quiz + leaderboard (P1)
4. Test on two phones against the live URL, fix bugs. No new features.

## Rules for the agent
- Build only the screens you're asked for in each session.
- Use DeepSpace primitives (auth, records, files, rooms, worker AI) instead of reimplementing them.
- No secrets in client code or in the repo. AI only via `createDeepSpaceAI` on the worker, billed to the app owner.
- Keep the UI minimal; working flow first.
- After each task, list the files you changed and what to test.

---

## Integrations used (for the writeup)
1. **Auth** (Google): ties books and quizzes to a user
2. **File storage**: keeps PDFs, so you don't re-upload
3. **Records + permissions**: persistence, plus "only the host controls the game" and "you can't write your own grade"
4. **AI (worker, via DeepSpace proxy)**: quiz generation and short-answer grading; no API keys in the app, billed to the app owner
5. **Real-time rooms + presence** (P1): lobby, synced questions, live answered count, live leaderboard. **Background jobs** (P1): short-answer grading for live rooms

## Deliberately left out (say why in the writeup)
- **Quiz review/edit step.** The quiz-taker is usually the creator, so reviewing would reveal the answers. Quality comes from schema validation, source pages, and code-graded multiple choice instead.
- **Quiz history / saved solo results / best scores.** Cut to focus on the core loop; next step is persisting attempts so users can track progress.
- **Per-game record scopes.** One app-wide scope is enough at evaluation scale; next step is one Durable Object per live game.
- **Payments.** No reason to charge for an evaluation build.
- **Messaging/chat.** A quiz room doesn't need chat; it would distract.
- **Managed knowledge/RAG.** Each quiz uses one chapter, so passing the text directly is simpler and cheaper than building an index.
- **Automatic chapter detection** for PDFs without an outline. Hard, open-ended problem; a page range covers it.
- **UI polish.** Minimal UI to prioritize a working end-to-end flow; list specific polish items as "next."

## Writeup notes (collect these as you go)
- What the agent built vs. what you verified or changed (keep a running list in docs/LOG.md)
- Main tradeoff: client-side PDF text extraction + page-range fallback, instead of server-side parsing or auto-detection
- No review step (spoils answers); multiple choice graded in code; AI only grades the short answer, grounded in the chapter text
- Installed DeepSpace's official agent skill so the agent used the real SDK instead of guessing
- Anything unfinished, and exactly what you'd do next (including UI polish)
