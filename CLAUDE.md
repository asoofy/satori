# Satori — Open-Source SAT Prep

A free, open-source, locally hosted study app for the digital SAT. It takes its features from OnePrep and Dolphin. It has its own question bank, and every question comes with a step-by-step explanation. It is not for sale: no accounts, no payments, no cloud. Anyone can clone it and run it on their own machine.

## How to work in this repo (read first)

1. Read `ROADMAP.md`. Find the **first phase that still has unchecked items** and work on it.
2. Finish that phase completely before starting the next one. That means working code, a clean `npm run build`, passing tests, and each feature tried in the browser.
3. Tick the boxes in `ROADMAP.md` as items are finished. Commit after every finished item with a clear message.
4. **Don't stop after one phase.** Go straight on to the next unchecked phase. Stop only when every phase is done, or when you're truly blocked (missing credentials, or a decision only the owner can make). If you're blocked, write the question under `## Open questions` in `ROADMAP.md` and carry on with anything that isn't blocked.
5. Never ship placeholder UI, "coming soon" stubs or fake data presented as real. A feature is either working or not built yet.
6. Keep `README.md` accurate after every phase: how to install and run it, and what's included.

## Stack (decided — don't change without a strong reason)

- **Next.js (App Router) + TypeScript + Tailwind.** Check `node_modules/next/dist/docs/` for the installed version's APIs before writing code. `params` and `searchParams` are async, and Turbopack is the default.
- **SQLite** as a single local file at `data/satori.db`. Prefer Node's built-in `node:sqlite`, so Windows users don't need native build tools. If it won't bundle, fall back to `better-sqlite3`. Use plain SQL migrations in `db/migrations/`, applied automatically on startup.
- Pages read from the database on the server and render dynamically. Changes go through route handlers or server actions.
- **KaTeX** for math: question text is Markdown with `$…$` for LaTeX.
- **Vitest** for unit tests, **Playwright** for a few end-to-end smoke tests.
- The app runs with `npm install && npm run dev`. `npm run seed` loads the bundled question bank. Node 22.13 or later is required, and should be set in `engines`.
- AI features are optional and switched on through `.env.local`: `ANTHROPIC_API_KEY`, or `OLLAMA_URL` + `OLLAMA_MODEL` for a free local model. **The app must be fully usable with no AI configured.**

## Question content rules (important)

- **Never scrape or copy questions from College Board, Khan Academy, OnePrep, Dolphin or any other prep site.** College Board's terms ban scraping and redistribution, and this is a public repo. Every question in the repo has to be one we're allowed to publish.
- The question bank is filled from these sources:
  1. **Original hand-written questions** in `content/questions/*.json`, covering every digital SAT skill at every difficulty.
  2. **Math template generators** in `content/generators/`. Each is a parametrized template that computes the answer, builds distractors from common student errors, and writes the explanation. Seed them so their IDs stay stable.
  3. **AI generator (Phase 4)**, which produces new original questions. A second model pass solves each one without seeing the answer key, and only questions that pass are saved.
  4. **Import tool**: JSON and CSV import for any set the user has rights to, with a validation report. An optional adapter for OpenSAT's public API runs only on the user's machine and never commits imported data to the repo.
- Store `source` and `license` on every question.

## Question schema (minimum)

`id, section (RW|MATH), domain, skill, difficulty (1–3), type (mcq|spr), stem_md, passage_md?, choices[4]?, answer, explanation_md, distractor_notes?, tags[], source, license, created_at`

Use the official digital SAT taxonomy:
- **Reading & Writing**
  - Information & Ideas: Central Ideas & Details, Command of Evidence (Textual / Quantitative), Inferences
  - Craft & Structure: Words in Context, Text Structure & Purpose, Cross-Text Connections
  - Expression of Ideas: Rhetorical Synthesis, Transitions
  - Standard English Conventions: Boundaries, Form, Structure & Sense
- **Math**
  - Algebra
  - Advanced Math
  - Problem-Solving & Data Analysis
  - Geometry & Trigonometry
  - Each with its official sub-skills.

## Product principles

- Everything is local. Progress lives in SQLite. Several local profiles are supported (for example, siblings sharing a laptop).
- Every answer screen shows the full explanation plus why each wrong choice is wrong.
- Scores are labeled as estimates. Never claim official scoring.
- Clean, friendly UI inspired by OnePrep and Dolphin, with its own identity (don't copy their branding, mascots or assets). Light and dark mode. Works on phone width.

@AGENTS.md
