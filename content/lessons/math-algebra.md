---
slug: linear-equations-one-var
skill: linear-equations-one-var
title: Linear Equations in One Variable
summary: Solve for x, count solutions, and set up equations from words.
---
## Solving

Undo operations in reverse order, doing the same thing to both sides:

$$3(x - 4) + 5 = 20 \;\Rightarrow\; 3(x-4) = 15 \;\Rightarrow\; x - 4 = 5 \;\Rightarrow\; x = 9$$

Always check by substituting back: $3(9 - 4) + 5 = 20$ ✓.

## How many solutions?

After simplifying to $ax + b = cx + d$:

| Situation | Solutions |
|---|---|
| $a \ne c$ | exactly one |
| $a = c$ and $b = d$ | infinitely many (same line) |
| $a = c$ and $b \ne d$ | none |

## Worked example

If $5(kx - 2) = 15x + c$ has infinitely many solutions, then $5k = 15$ and $-10 = c$, so $k = 3$ and $c = -10$.

---
slug: linear-functions
skill: linear-functions
title: Linear Functions
summary: Slope, intercepts, and linear models in context.
---
## The key facts

- $f(x) = mx + b$: the **slope** $m$ is the change in output per 1-unit increase in input, and $b = f(0)$ is the **starting value**.
- Slope from two points: $m = \dfrac{y_2 - y_1}{x_2 - x_1}$.
- To evaluate at a new point, start from a known point: $f(c) = f(a) + m(c - a)$.

## In context

"A candle 30 cm tall burns 1.5 cm per hour" → $h(t) = 30 - 1.5t$. The fixed amount is the intercept; the per-unit amount is the slope (negative if decreasing).

## Worked example

$g(2) = 11$ and $g(5) = 20$. The slope is $\frac{20 - 11}{5 - 2} = 3$, so $g(0) = 11 - 3 \cdot 2 = 5$.

---
slug: linear-equations-two-var
skill: linear-equations-two-var
title: Linear Equations in Two Variables
summary: Lines in the plane, intercepts, parallel and perpendicular lines.
---
## Forms of a line

- Slope-intercept: $y = mx + b$.
- Standard: $Ax + By = C$. The $x$-intercept is at $y = 0$, and the $y$-intercept is at $x = 0$.

## Parallel and perpendicular

- **Parallel** lines have equal slopes.
- **Perpendicular** slopes are negative reciprocals: $\frac{3}{4} \to -\frac{4}{3}$.

## Word problems

"Notebooks cost \$3, pens cost \$2, total \$24": $3n + 2p = 24$. Each term is a price times a quantity.

## Worked example

The line perpendicular to $y = \frac{3}{4}x - 2$ through $(6, 1)$ has slope $-\frac43$, so $1 = -\frac43(6) + b$ gives $b = 9$.

---
slug: systems-linear
skill: systems-linear
title: Systems of Linear Equations
summary: Substitution, elimination, and counting solutions.
---
## Methods

- **Substitution:** when one variable is already isolated ($y = 3x$).
- **Elimination:** add or subtract equations to cancel a variable. Look for matching or opposite coefficients.
- **Shortcut:** if the question asks for $x + y$, try adding the equations first.
- **Desmos:** type both equations and click the intersection.

## Number of solutions

| Lines | Solutions |
|---|---|
| different slopes | one |
| same slope, different intercept (parallel) | none |
| identical | infinitely many |

For "no solution", make the $x$ and $y$ coefficients proportional but the constants not.

## Worked example

$6x - 4y = 9$ and $ax - 10y = 20$ have no solution when $\frac{a}{6} = \frac{-10}{-4}$, so $a = 15$ (and $\frac{20}{9} \ne \frac{5}{2}$ ✓).

---
slug: linear-inequalities
skill: linear-inequalities
title: Linear Inequalities
summary: Solve inequalities and translate word limits.
---
## Rules

- Solve like an equation, **but flip the sign when you multiply or divide by a negative**.
- "At most" means $\le$, "at least" means $\ge$, "more than" means $>$, "fewer than" means $<$.

## Systems of inequalities

To test a point, check it in **every** inequality. A strict inequality ($<$ or $>$) excludes the boundary.

## Worked example

$b - 3x \ge 12$ with $b = 3$: $-3x \ge 9$, so dividing by $-3$ flips the sign: $x \le -3$. The greatest integer solution is $-3$.
