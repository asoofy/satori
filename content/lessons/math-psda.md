---
slug: ratios-rates-units
skill: ratios-rates-units
title: Ratios, Rates, and Units
summary: Proportions, unit rates, and unit conversions.
---
## Proportions

Keep the same order on both sides: $\frac{\text{flour}}{\text{sugar}} = \frac{\text{flour}}{\text{sugar}}$. Then cross-multiply.

## Ratio parts

A ratio $a:b$ with total $T$ splits into $a + b$ equal parts, and each part is $\frac{T}{a+b}$.

## Unit conversion

Multiply by fractions equal to 1 so the units cancel:

$$15\,\tfrac{\text{m}}{\text{s}} \times \tfrac{3600\,\text{s}}{1\,\text{h}} \times \tfrac{1\,\text{km}}{1000\,\text{m}} = 54\,\tfrac{\text{km}}{\text{h}}$$

## Combined rates

Add **rates**, not times. A 60-gallon tank filled by hoses at 2.4 and 4 gallons per minute takes $\frac{60}{6.4} = 9.375$ minutes.

---
slug: percentages
skill: percentages
title: Percentages
summary: Percent change, successive changes, and reverse percents.
---
## Multipliers

- Increase by $p\%$: multiply by $1 + \frac{p}{100}$. Decrease: multiply by $1 - \frac{p}{100}$.
- **Successive changes multiply:** up 25% then down 20% gives $1.25 \times 0.8 = 1$, so no change.

## Percent change

$$\text{percent change} = \frac{\text{new} - \text{original}}{\text{original}} \times 100\%$$

Always divide by the **original** amount.

## Reverse percent

"After a 20% increase it’s 360": original $= \frac{360}{1.2} = 300$, not $360 \times 0.8$.

---
slug: one-var-data
skill: one-var-data
title: One-Variable Data
summary: Mean, median, spread, and outliers.
---
## Center

- **Mean** = total ÷ count. For "a value was added" questions, work with **totals**.
- **Median** = middle value of the **sorted** list (with an even count, average the two middle values). In a frequency table, count up to the middle position.

## Spread

- Range = max − min. Standard deviation measures typical distance from the mean.
- Adding a constant to every value shifts the center but not the spread. Multiplying by $k$ multiplies the spread by $k$.

## Outliers

A high outlier pulls the mean up a lot but barely moves the median.

## Worked example

Mean of 5 numbers is 20; adding one number makes the mean 22. The new total is $6 \times 22 = 132$ and the old total is $100$, so the added number is $32$.

---
slug: two-var-data
skill: two-var-data
title: Two-Variable Data
summary: Scatterplots, lines of best fit, and choosing a model.
---
## Line of best fit

In $y = mx + b$, the slope $m$ is the **predicted** change in $y$ per 1-unit increase in $x$, and $b$ is the predicted $y$ when $x = 0$. Predictions are estimates, not exact values.

## Linear or exponential?

- Equal **differences** between consecutive outputs → linear.
- Equal **ratios** → exponential.

| x | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| y | 3 | 6 | 12 | 24 |

The ratios are all 2, so the model is $y = 3 \cdot 2^x$.

---
slug: probability
skill: probability
title: Probability
summary: Basic and conditional probability from counts and tables.
---
## Basics

$$P(\text{event}) = \frac{\text{favorable outcomes}}{\text{total outcomes}}$$

## Conditional probability

"Given that…" or "if a person chosen from group X…" means the **denominator is group X only**.

In a two-way table:

- $P(\text{apartment} \mid \text{owns a pet}) = \dfrac{\text{pet owners in apartments}}{\text{all pet owners}}$
- $P(\text{owns a pet} \mid \text{apartment})$ has a **different** denominator: everyone in an apartment.

## Worked example

18 of the 69 pet owners live in apartments, so $P = \frac{18}{69} = \frac{6}{23}$.

---
slug: sample-statistics
skill: sample-statistics
title: Samples and Margin of Error
summary: What a random sample does and doesn't tell you.
---
## Key ideas

- A **random** sample can estimate a population value: $\text{estimate} = \text{sample proportion} \times \text{population size}$.
- A margin of error gives a **plausible range** for the population value: $56\% \pm 5\%$ means 51% to 61%.
- **Larger samples** give **smaller** margins of error.
- Results only generalize to the population the sample was drawn from.

## Common trap

The margin of error describes the **population**, not the sample. The sample value is known exactly.

---
slug: evaluating-claims
skill: evaluating-claims
title: Evaluating Statistical Claims
summary: Observational studies vs. experiments; what conclusions are allowed.
---
## Two questions to ask

| Design feature | What it allows |
|---|---|
| **Random selection** from a population | Generalize to that population |
| **Random assignment** to treatment groups | Conclude cause and effect |

- An **observational study** (no random assignment) shows association only.
- Without random selection, results apply only to the people studied.

## Worked example

A school randomly selects 200 of its students and randomly assigns half to an app. The result generalizes to **that school**, and the app likely **caused** the difference.
