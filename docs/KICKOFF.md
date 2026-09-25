I'm building **Satori**, a free, open-source SAT prep app that runs locally. `CLAUDE.md` has the rules, the stack and the content policy. `ROADMAP.md` has every feature, split into 5 phases. Read both files fully before writing any code.

Build the whole thing, not a prototype. Start with Phase 1. When a phase is fully working (build passes, tests pass, features checked in the browser), tick its boxes, commit, and **go straight on to the next phase without waiting for me**. Keep going until all 5 phases are done. If you hit something only I can decide, add it under "Open questions" in `ROADMAP.md` and keep working on everything else.

Features are inspired by OnePrep and Dolphin:
- **Home dashboard:** test-date countdown, goal / current / predicted score, streak, gems, "Start today's session"
- **Study plan:** a daily plan and a date-unlocked learn path with a calendar
- **Practice:** question bank with filters, practice with full explanations, Saved & Mistakes, Question Rush, Challenge Questions
- **Tests:** full-length adaptive practice tests
- **Progress:** analytics by skill
- **Learning:** lessons, custom lessons, vocab with spaced repetition
- **Tutor:** AI tutor chat
- **Profiles:** local profiles with a leaderboard

Use your own design, not their branding.

Hard rule: don't scrape or copy questions from College Board or any prep site. Write original questions, build math template generators, and add the AI generator and importer exactly as `CLAUDE.md` describes.

Start now: scaffold the project, then work through Phase 1.
