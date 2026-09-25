# How Satori estimates your score

Satori shows a **predicted score** on the Home page. It is an **estimate** based on your practice answers. It is not an official score and can be wrong, especially when you have only answered a few questions.

## The model

Each section (Reading & Writing, Math) is estimated separately on the 200–800 scale, and the total is their sum.

We use a simple item-response model. For a student with section score θ, the chance of answering a question of difficulty *d* correctly is:

```
P(correct) = 1 / (1 + exp(−(θ − b_d) / s))
```

| Difficulty | b_d (the score at which a student gets it right half the time) |
|---|---|
| Easy (1) | 420 |
| Medium (2) | 560 |
| Hard (3) | 690 |

`s = 70` sets how quickly the probability changes as θ moves away from b_d.

### Weighting

- **Difficulty:** built into the model. Getting a hard question right pushes the estimate up more than getting an easy one right, and missing an easy question pulls it down more than missing a hard one.
- **Recency:** each answer is weighted by `0.5 ^ (days_ago / 21)`, so an answer from three weeks ago counts half as much as one from today. Your estimate follows your recent form.
- **Prior:** a weak normal prior (mean 500, SD 150) keeps estimates reasonable when there is little data.

We compute the weighted posterior for every θ from 200 to 800 in steps of 10 and pick the most likely value. The **±** shown is one standard error, from the curvature of the posterior (Fisher information). It shrinks as you answer more questions.

We show an estimate for a section only after you have answered at least **8** questions in it.

## Limitations

- The difficulty levels (b_d) are rough placements, not values calibrated against real test-takers.
- Practice questions differ from real test questions, and practice conditions (no time pressure, answers checked one at a time) differ from test day.
- Full-length practice tests (Phase 3) produce their own section scores with the same model, applied to that test’s answers only.

The code is in [`lib/scoring.ts`](../lib/scoring.ts) and the tests are in [`tests/unit/scoring.test.ts`](../tests/unit/scoring.test.ts).
