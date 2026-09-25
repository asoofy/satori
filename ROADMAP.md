# Roadmap

Work top to bottom. Tick each item when it's working and committed. Don't stop between phases.

## Phase 1 — Foundation + question bank
- [x] Scaffold Next.js + TypeScript + Tailwind, SQLite layer, auto-run migrations, `npm run seed`
- [x] Schema: profiles, questions, skills, attempts, saved, settings (goal score, test date)
- [x] Skill taxonomy seeded (the official digital SAT domains and skills)
- [x] Original question bank: at least 120 Reading & Writing and 60 Math questions written by hand, spread across skills and difficulties, each with an explanation
- [x] At least 20 Math template generators (linear equations, systems, percentages, ratios, quadratics, exponentials, functions, statistics, probability, circles, triangles, trig, and more)
- [x] **Question Bank page**: filter by section, domain, skill, difficulty, and unanswered / incorrect / saved
- [x] **Practice player**: multiple-choice and student-produced-response answers, KaTeX rendering, answer-choice elimination, timer, reveal explanation, save question
- [x] **Saved & Mistakes** page, with a "redo my mistakes" set
- [x] **Home dashboard**: greeting, test-date countdown, goal score, current and predicted score, streak, "Start today's session"
- [x] Onboarding: pick a test date, goal score and current score (optional)
- [x] Unit tests for generators (answer is correct, distractors are all different) and for grading

## Phase 2 — Study plan + progress
- [x] **Study Planner**: builds a day-by-day plan from the test date, available days per week and weakest skills; rebuilds itself when days are missed
- [x] **Learn path** (Dolphin-style): one node per day that unlocks by date, "What do I study?" button, weekly view
- [x] Calendar widget with completed and planned days
- [x] **Analytics**: accuracy and time per question by section, domain, skill and difficulty; trend over time; weakest skills list
- [x] **Predicted score** model, transparent and documented: weights difficulty and recency; 200–800 per section; labeled as an estimate
- [x] Streaks, XP/gems, daily goal
- [x] Getting-started checklist (like OnePrep's 0/5)
- [x] **Desmos calculator** panel in Math practice (API key via env, with Desmos's documented demo key as the development default) plus a reference sheet

## Phase 3 — Full-length practice tests
- [x] Test engine in the digital SAT format: Reading & Writing 2 × 27 questions (32 min per module), Math 2 × 22 (35 min per module), a break between sections
- [x] **Adaptive routing**: module 2 is easier or harder depending on module 1 performance; tests are built from the bank by skill and difficulty blueprint
- [x] Bluebook-style test UI: timer (can be hidden), flag for review, answer eliminator, question navigator, highlight and notes on passages
- [x] Score report: estimated section and total score, breakdown by domain, review every question with explanations
- [x] Section-only and single-module mini tests
- [x] **Question Rush** (timed streak mode) and **Challenge Questions** (hardest-only set)

## Phase 4 — Content engine
- [x] AI question generator (Anthropic or Ollama): choose skill and difficulty, generate a batch, independent solve-check, dedupe, review queue, approve into the bank
- [x] Import: JSON and CSV with schema validation and an error report; export the bank as JSON
- [x] Optional OpenSAT API adapter (runs locally, marks source and license, data never committed)
- [x] **Lessons / Masterclass**: short lessons per skill (Markdown + worked examples + a linked practice set), including "How to use Desmos"
- [x] **Custom Lessons**: the user picks skills and gets a generated lesson plus a practice set
- [x] **Vocab**: SAT word list (written for this project), flashcards with SM-2 spaced repetition, words-in-context drills

## Phase 5 — Tutor, profiles, ship
- [x] **Ask Tutor**: chat that knows the current question and the user's weak skills (AI optional; hidden when not configured)
- [x] Several local profiles plus a local leaderboard / leagues between profiles
- [x] Settings: theme, daily goal, reset progress, backup and restore the database file
- [x] Polish for dark mode, mobile layout and accessibility (keyboard navigation, focus states, contrast)
- [x] Dockerfile + docker-compose
- [x] Playwright smoke tests for main flows; GitHub Actions CI (lint, typecheck, test, build)
- [x] README (screenshots, install, `.env` options), CONTRIBUTING (how to add questions and generators), LICENSE (MIT for code, CC BY 4.0 for original content)

## Open questions
<!-- Claude: add blockers here instead of stopping. -->
Nothing is blocking. These are decisions or checks for the owner:

- **AI features were verified against a mock provider only.** The generator pipeline (solve-check, dedupe, review queue), custom-lesson AI path and tutor are covered by unit tests with a fake provider, and the UI hides them when no key is set. No `ANTHROPIC_API_KEY` or Ollama was available while building, so a live run hasn't happened. To check: add a key to `.env.local`, generate 3 questions for one skill, and open Ask Tutor.
- **The Docker image wasn't built here** because Docker isn't installed on the build machine. The standalone Next.js server it runs was started and checked on a fresh database: health check, seeding, onboarding redirect. Please run `docker compose up --build` once.
- **Desmos API key:** the app defaults to Desmos's documented demo key, which is fine for personal local use. If you ever host Satori publicly, get your own key from Desmos and set `NEXT_PUBLIC_DESMOS_API_KEY`.
- **OpenSAT adapter:** OpenSAT doesn't publish a license or say where its questions come from. The adapter keeps imports local, labels them "license unknown" and leaves them out of exports by default. You may prefer to remove the adapter entirely.
- **Content volume:** 132 hand-written R&W questions means full-length tests start repeating R&W questions after about two tests. Math is unlimited through the generators. More R&W content, hand-written or via the AI generator plus review, is the most useful next addition.
