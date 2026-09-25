# Content guide

How to add questions, math generators, lessons and vocabulary. For setup and the pull-request workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Ground rules for content

- **Write it yourself.** Never copy or closely paraphrase questions or passages from the College Board, Khan Academy, OnePrep, Dolphin, test-prep books or any other source. This repo is public, and every item must be one we're allowed to publish.
- Invented literary or historical passages must say they were written for this collection. Researchers and studies may be fictional, but don't attribute made-up findings to real people.
- Every multiple-choice question needs **one** correct answer, a step-by-step `explanation_md`, and a `distractor_notes` entry for **each** wrong choice.

## Adding hand-written questions

Questions live in `content/questions/*.json`:

```json
{
  "source": "satori-original",
  "license": "CC-BY-4.0",
  "questions": [
    {
      "id": "rw-tr-13",
      "section": "RW",
      "skill": "transitions",
      "difficulty": 2,
      "type": "mcq",
      "passage_md": "The bridge was closed for repairs. ______ commuters took the ferry.",
      "stem_md": "Which choice completes the text with the most logical transition?",
      "choices": ["As a result,", "However,", "For example,", "Similarly,"],
      "answer": "A",
      "explanation_md": "The closure caused the change in commuting, so a cause-and-effect transition fits.",
      "distractor_notes": { "B": "No contrast here.", "C": "Not an example.", "D": "Not a similar idea." },
      "tags": ["cause-effect"]
    }
  ]
}
```

- `section` is `RW` or `MATH`; `skill` is an id from `content/taxonomy.json`; `difficulty` is 1 (easy), 2 (medium) or 3 (hard).
- `type` is `mcq` (four `choices`, `answer` is a letter) or `spr` (student-produced response: `answer` is a number or fraction such as `7/2`; separate several accepted answers with `|`).
- Text is Markdown. Math goes in `$…$` (or `$$…$$` for display). **Write a literal dollar sign as `\\$` in JSON**, or it starts math mode.
- Ids must be unique. Use the prefix pattern of the file you add to.

Run `npm test`. The content tests check the schema, notes for every wrong choice, SPR keys the grader accepts, balanced math delimiters, and unescaped dollar signs.

## Adding a math template generator

Generators live in `content/generators/` (`algebra.ts`, `advanced.ts`, `psda.ts`, `geometry.ts`). A generator is a parametrized template:

```ts
export const myGenerator: Generator = {
  id: "my-generator",               // stable forever: instance ids depend on it
  title: "What it practices",
  skill: "percentages",             // a MATH skill id
  difficulties: [1, 2],
  generate(rng, difficulty) {
    // 1. pick numbers with rng (randInt, pick, randNonZero…) so output is deterministic
    // 2. compute the correct answer
    // 3. build distractors from realistic mistakes with buildMcq(rng, correct, candidates, format, fallback)
    // 4. write a step-by-step explanation
    return mcq(stem, built, explanation, params); // or spr(stem, answerText, explanation, value, params)
  },
  // Independent check used by the tests: does `value` solve the problem in `params`?
  // Prefer substitution or a different method from the one used to build the question.
  check(params, value) { /* … */ },
};
```

Add it to the list at the bottom of the file. The tests run every generator at every difficulty for 200 seeds and check that:

- exactly one choice passes `check`, and it's the keyed answer;
- all four choices are distinct, and each wrong one has a note;
- SPR keys are accepted by the grader and fit the answer box;
- output is deterministic and valid against the question schema.

Use `ratTex` / `ratText` for fractions so answers stay exact.

## Lessons and vocabulary

- Lessons are Markdown files in `content/lessons/`. Each lesson starts with a frontmatter block (`slug`, optional `skill`, `title`, `summary`). Don't use a bare `---` line inside a lesson body; it starts a new lesson.
- Vocabulary lives in `content/vocab.json`. Each example sentence must contain the word (simple endings like *-s* or *-ed* are fine), since the drills blank it out.
