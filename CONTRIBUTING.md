# Contributing to Satori

Thanks for helping! The most useful contributions are **original questions**, **new math generators**, better lessons and bug fixes.

## Set up

You need Node.js 22.13 or later.

```bash
git clone <your-fork-url> satori
cd satori
npm install
npm run dev      # http://localhost:3000
```

## Branch

Fork the repo, then create a branch from `main` with a short, descriptive name:

```bash
git checkout -b fix/grid-in-fractions
```

Keep each branch to one change.

## Open a pull request

1. Run the checks. They must pass (CI runs the same ones):
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```
   For UI changes, also run `npm run test:e2e`.
2. Push your branch and open a PR against `main`. Say what changed and why, and add a screenshot for UI changes.

## Rules

- **Never copy questions** from the College Board, Khan Academy, OnePrep, Dolphin, prep books or any other source, and never paraphrase them closely. Every item must be one we're allowed to publish. See the [content guide](docs/CONTENT.md) for the question format, generators, lessons and vocab.
- Keep scores labeled as **estimates**, and keep the app fully usable without AI.
- Database changes go in a **new** numbered file in `db/migrations/`. Never edit a released migration.
- Report security problems privately, as described in [SECURITY.md](SECURITY.md), not in a public issue.

By contributing, you agree that your code is released under the [MIT License](LICENSE) and your content under [CC BY 4.0](LICENSE-CONTENT.md).
