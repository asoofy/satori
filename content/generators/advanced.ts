import {
  approxEqual,
  buildMcq,
  coef,
  type Generator,
  m,
  mcq,
  pick,
  randInt,
  randNonZero,
  ratTex,
  ratText,
  signed,
  spr,
} from "./_lib";

/** LaTeX for ax^2 + bx + c, skipping zero terms. */
export function quadTex(a: number, b: number, c: number, v = "x"): string {
  let s = `${coef(a)}${v}^2`;
  if (b !== 0) s += ` ${b < 0 ? "-" : "+"} ${coef(Math.abs(b))}${v}`;
  if (c !== 0) s += ` ${signed(c)}`;
  return s;
}

export const quadraticRoots: Generator = {
  id: "quadratic-roots",
  title: "Solutions of a quadratic equation",
  skill: "nonlinear-equations",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    if (difficulty === 3) {
      // Sum of solutions of ax^2 + bx + c = 0 (Vieta)
      const a = randInt(rng, 2, 6);
      const b = randNonZero(rng, -15, 15);
      let c = randNonZero(rng, -12, 12);
      if (b * b - 4 * a * c < 0) c = -Math.abs(c); // make sure real solutions exist
      const params = { kind: "sum", a, b, c };
      const built = buildMcq(
        rng,
        -b / a,
        [
          { value: b / a, note: "The sum of the solutions is −b/a; this answer forgot the negative sign." },
          { value: c / a, note: "c/a is the product of the solutions, not the sum." },
          { value: -c / a, note: "Mixed up the formulas for the sum and product, and the sign." },
          { value: -b, note: `Forgot to divide by the leading coefficient ${m(a)}.` },
        ],
        (v) => m(ratTex(v)),
        (i) => ({ value: -b / a + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `What is the sum of the solutions to ${m(`${quadTex(a, b, c)} = 0`)}?`,
        built,
        [
          `For ${m("ax^2 + bx + c = 0")}, the solutions from the quadratic formula are ${m("\\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}")}.`,
          `Adding them, the ${m("\\pm\\sqrt{\\;}")} parts cancel, leaving ${m("\\dfrac{-2b}{2a} = -\\dfrac{b}{a}")}.`,
          ``,
          `Here ${m(`a = ${a}`)} and ${m(`b = ${b}`)}, so the sum is ${m(`-\\dfrac{${b}}{${a}} = ${ratTex(-b / a)}`)}.`,
          ``,
          `(The discriminant ${m(`${b * b - 4 * a * c}`)} is positive, so there are two real solutions.)`,
        ].join("\n"),
        params,
      );
    }
    // Roots r (positive) and s (negative)
    const r = randInt(rng, 1, 12);
    const s = -randInt(rng, 1, 12);
    const b = -(r + s);
    const c = r * s;
    const params = { kind: "positive-root", a: 1, b, c };
    const stem = `What is the positive solution to ${m(`${quadTex(1, b, c)} = 0`)}?`;
    const explanation = [
      `Factor: find two numbers whose product is ${m(c)} and whose sum is ${m(b)}. They are ${m(-r)} and ${m(-s)}.`,
      ``,
      `$$${quadTex(1, b, c)} = (x - ${r})(x + ${-s}) = 0$$`,
      ``,
      `So ${m(`x = ${r}`)} or ${m(`x = ${s}`)}. The positive solution is ${m(r)}.`,
    ].join("\n");
    if (difficulty === 2) return spr(stem, String(r), explanation, r, params);
    const built = buildMcq(
      rng,
      r,
      [
        { value: -s, note: `Sign error: the factor ${m(`(x + ${-s})`)} gives ${m(`x = ${s}`)}, not ${m(-s)}.` },
        { value: Math.abs(c), note: "This is the constant term, not a solution." },
        { value: Math.abs(b) === r ? r + 1 : Math.abs(b), note: "This is the absolute value of the x-coefficient, not a solution." },
      ],
      (v) => m(v),
      (i) => ({ value: r + i, note: "Does not make the equation true." }),
    );
    return mcq(stem, built, explanation, params);
  },
  check(p, v: number) {
    if (p.kind === "sum") {
      const disc = Math.sqrt(p.b * p.b - 4 * p.a * p.c);
      const x1 = (-p.b + disc) / (2 * p.a);
      const x2 = (-p.b - disc) / (2 * p.a);
      return approxEqual(v, x1 + x2);
    }
    return v > 0 && approxEqual(p.a * v * v + p.b * v + p.c, 0);
  },
};

export const quadraticVertex: Generator = {
  id: "quadratic-vertex",
  title: "Minimum value of a quadratic function",
  skill: "nonlinear-functions",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const a = difficulty === 2 ? 1 : randInt(rng, 2, 4);
    const h = randNonZero(rng, -7, 7);
    const k = randInt(rng, -20, 20);
    // f(x) = a(x - h)^2 + k = ax^2 - 2ahx + (ah^2 + k)
    const b = -2 * a * h;
    const c = a * h * h + k;
    const params = { a, b, c };
    const stem = `The function ${m("f")} is defined by ${m(`f(x) = ${quadTex(a, b, c)}`)}. What is the minimum value of ${m("f(x)")}?`;
    const explanation = [
      `The graph is a parabola opening upward (${m(`a = ${a} > 0`)}), so the minimum is at the vertex.`,
      ``,
      `1. The x-coordinate of the vertex is ${m(`-\\dfrac{b}{2a} = -\\dfrac{${b}}{${2 * a}} = ${h}`)}.`,
      `2. Evaluate: ${m(`f(${h}) = ${a === 1 ? "" : a}(${h})^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${h}) ${signed(c)} = ${k}`)}.`,
      ``,
      `Equivalently, completing the square gives ${m(`f(x) = ${a === 1 ? "" : a}(x ${signed(-h)})^2 ${signed(k)}`)}, whose minimum value is ${m(k)}.`,
    ].join("\n");
    if (difficulty === 3) return spr(stem, String(k), explanation, k, params);
    const built = buildMcq(
      rng,
      k,
      [
        { value: h, note: "This is the x-value where the minimum happens, not the minimum value." },
        { value: c, note: `This is ${m("f(0)")}, the y-intercept, not the minimum.` },
        { value: c + (b * b) / (4 * a), note: "Sign error when completing the square." },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: k - i, note: "No input produces this value." }),
    );
    return mcq(stem, built, explanation, params);
  },
  check(p, v: number) {
    // v is the minimum iff f(x) - v = 0 has exactly one (double) root: discriminant zero.
    return approxEqual(p.b * p.b - 4 * p.a * (p.c - v), 0) && p.a > 0;
  },
};

export const exponentialModel: Generator = {
  id: "exponential-model",
  title: "Exponential growth and decay",
  skill: "nonlinear-functions",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const P0 = randInt(rng, 2, 30) * 50;
      const d = randInt(rng, 2, 6);
      const n = randInt(rng, 2, 4);
      const t = d * n;
      const ans = P0 * 2 ** n;
      const params = { kind: "double", P0, d, t };
      const built = buildMcq(
        rng,
        ans,
        [
          { value: P0 * 2 * n, note: "Added the doubling linearly instead of compounding it." },
          { value: P0 * 2 ** t, note: `Doubled every year for ${t} years instead of every ${d} years.` },
          { value: P0 * 2 ** (n - 1), note: "Counted one doubling too few." },
        ],
        (v) => m(v.toLocaleString("en-US").replace(/,/g, "{,}")),
        (i) => ({ value: ans + i * P0, note: "Arithmetic slip." }),
      );
      return mcq(
        `A culture of bacteria starts with ${m(P0)} cells, and the number of cells doubles every ${m(d)} hours. How many cells will there be after ${m(t)} hours?`,
        built,
        [
          `In ${m(t)} hours there are ${m(`${t} \\div ${d} = ${n}`)} doubling periods.`,
          ``,
          `$$${P0} \\cdot 2^{${n}} = ${P0} \\cdot ${2 ** n} = ${ans}$$`,
        ].join("\n"),
        params,
      );
    }
    const growth = difficulty === 2 ? true : rng() < 0.5;
    const pct = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25]);
    const P0 = randInt(rng, 5, 90) * 100;
    const r = pct / 100;
    const factor = growth ? 1 + r : 1 - r;
    const thing = growth ? pick(rng, ["the population of a town", "the number of members of a club", "the value of an investment"]) : pick(rng, ["the value of a car", "the amount of a medication in the bloodstream", "the number of trees in a forest"]);
    const params = { P0, factor };
    type Model = { base: number; mode: "exp" | "lin"; coef: number };
    const fmt = (v: Model) =>
      v.mode === "exp"
        ? m(`f(t) = ${v.coef}(${v.base})^t`)
        : m(`f(t) = ${v.coef}(1 ${v.base < 0 ? "-" : "+"} ${Math.abs(v.base)}t)`);
    const built = buildMcq<Model>(
      rng,
      { base: factor, mode: "exp", coef: P0 },
      [
        { value: { base: growth ? 1 - r : 1 + r, mode: "exp", coef: P0 }, note: growth ? "This models a decrease, not an increase." : "This models an increase, not a decrease." },
        { value: { base: r, mode: "exp", coef: P0 }, note: `Used the rate ${m(r)} as the growth factor; the factor must be ${m(`1 ${growth ? "+" : "-"} ${r}`)}.` },
        { value: { base: growth ? r : -r, mode: "lin", coef: P0 }, note: "This is a linear model: it changes by the same amount each year, not the same percent." },
      ],
      fmt,
      (i) => ({ value: { base: Number((factor + i / 100).toFixed(2)), mode: "exp", coef: P0 }, note: "Wrong growth factor." }),
    );
    return mcq(
      `In a model, ${thing} ${growth ? "increases" : "decreases"} by ${m(`${pct}\\%`)} each year. At ${m("t = 0")} the amount is ${m(P0)}. Which function ${m("f")} gives the amount ${m("t")} years later?`,
      built,
      [
        `Changing by the same **percent** each year is exponential: ${m("f(t) = P_0 \\cdot (\\text{growth factor})^t")}.`,
        ``,
        `A ${pct}% ${growth ? "increase" : "decrease"} means each year's amount is ${m(`1 ${growth ? "+" : "-"} ${r} = ${factor}`)} times the previous year's.`,
        ``,
        `So ${m(`f(t) = ${P0}(${factor})^t`)}.`,
      ].join("\n"),
      params,
    );
  },
  check(p, v) {
    if (p.kind === "double") {
      // simulate hour by hour
      let cells = p.P0;
      for (let h = 1; h <= p.t; h++) if (h % p.d === 0) cells *= 2;
      return v === cells;
    }
    // simulate year by year and compare the model's predictions
    let amt = p.P0;
    for (let t = 1; t <= 4; t++) {
      amt *= p.factor;
      const pred = v.mode === "exp" ? v.coef * v.base ** t : v.coef * (1 + v.base * t);
      if (!approxEqual(pred, amt)) return false;
    }
    return true;
  },
};

export const functionEval: Generator = {
  id: "function-eval",
  title: "Evaluate a quadratic function",
  skill: "nonlinear-functions",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const a = difficulty === 1 ? 1 : randNonZero(rng, -4, 5);
    const b = randInt(rng, -9, 9);
    const c = randInt(rng, -15, 15);
    const k = difficulty === 1 ? randInt(rng, 2, 6) : -randInt(rng, 2, 6);
    const f = (x: number) => a * x * x + b * x + c;
    const ans = f(k);
    const params = { a, b, c, k };
    const built = buildMcq(
      rng,
      ans,
      [
        { value: -a * k * k + b * k + c, note: `Squared the negative incorrectly: ${m(`(${k})^2 = ${k * k}`)}, which is positive.` },
        { value: (a * k) ** 2 + b * k + c, note: `Squared ${m(`${a}\\cdot ${k}`)} instead of squaring only ${m("x")}.` },
        { value: a * 2 * k + b * k + c, note: `Treated ${m("x^2")} as ${m("2x")}.` },
        { value: a * k * k - b * k + c, note: "Sign error on the middle term." },
      ],
      (v) => m(v),
      (i) => ({ value: ans + i, note: "Arithmetic slip." }),
    );
    return mcq(
      `The function ${m("f")} is defined by ${m(`f(x) = ${quadTex(a, b, c) || "0"}`)}. What is the value of ${m(`f(${k})`)}?`,
      built,
      [
        `Substitute ${m(`x = ${k}`)}, using parentheses so the sign is squared too:`,
        ``,
        `$$f(${k}) = ${a === 1 ? "" : a === -1 ? "-" : a}(${k})^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${k}) ${signed(c)}$$`,
        ``,
        `$$= ${a * k * k} ${signed(b * k)} ${signed(c)} = ${ans}$$`,
      ].join("\n"),
      params,
    );
  },
  check(p, v: number) {
    // Horner's method
    return v === (p.a * p.k + p.b) * p.k + p.c;
  },
};

export const functionComposition: Generator = {
  id: "function-composition",
  title: "Composition of functions",
  skill: "nonlinear-functions",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const a = randNonZero(rng, -5, 6);
    const b = randInt(rng, -9, 9);
    const c = randInt(rng, -8, 8);
    const k = randNonZero(rng, -4, 4);
    const f = (x: number) => a * x + b;
    const g = (x: number) => x * x + c;
    const ans = f(g(k));
    const params = { a, b, c, k };
    const fTex = `${coef(a)}x${b === 0 ? "" : ` ${signed(b)}`}`;
    const gTex = `x^2${c === 0 ? "" : ` ${signed(c)}`}`;
    const stem = `The functions ${m("f")} and ${m("g")} are defined by ${m(`f(x) = ${fTex}`)} and ${m(`g(x) = ${gTex}`)}. What is the value of ${m(`f(g(${k}))`)}?`;
    const explanation = [
      `Work from the inside out.`,
      ``,
      `1. ${m(`g(${k}) = (${k})^2 ${signed(c)} = ${g(k)}`)}.`,
      `2. ${m(`f(${g(k)}) = ${a}(${g(k)}) ${signed(b)} = ${ans}`)}.`,
    ].join("\n");
    if (difficulty === 3) return spr(stem, String(ans), explanation, ans, params);
    const built = buildMcq(
      rng,
      ans,
      [
        { value: g(f(k)), note: `This is ${m(`g(f(${k}))`)} — the functions were applied in the wrong order.` },
        { value: f(k) * g(k), note: `This is ${m(`f(${k})\\cdot g(${k})`)}, a product, not a composition.` },
        { value: f(k) + g(k), note: `This is ${m(`f(${k}) + g(${k})`)}.` },
      ],
      (v) => m(v),
      (i) => ({ value: ans + i, note: "Arithmetic slip." }),
    );
    return mcq(stem, built, explanation, params);
  },
  check(p, v: number) {
    const inner = p.k ** 2 + p.c;
    return v === p.a * inner + p.b;
  },
};

export const binomialProduct: Generator = {
  id: "binomial-product",
  title: "Expand a product of binomials",
  skill: "equivalent-expressions",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const a = difficulty === 1 ? 1 : randInt(rng, 2, 6);
    const b = randNonZero(rng, -9, 9);
    const c = difficulty === 1 ? 1 : randNonZero(rng, -5, 6);
    const d = randNonZero(rng, -9, 9);
    const A = a * c;
    const B = a * d + b * c;
    const C = b * d;
    const params = { a, b, c, d };
    const bin = (p: number, q: number) => `(${coef(p)}x ${signed(q)})`;
    type Poly = { A: number; B: number; C: number };
    const built = buildMcq<Poly>(
      rng,
      { A, B, C },
      [
        { value: { A, B: 0, C }, note: "Multiplied only first terms and last terms, skipping the middle (outer and inner) products." },
        { value: { A, B: a * d - b * c, C }, note: "Sign error when combining the outer and inner products." },
        { value: { A, B, C: -C }, note: "Sign error on the constant term." },
        { value: { A: a + c, B, C: b + d }, note: "Added coefficients instead of multiplying them." },
      ],
      (v) => m(v.B === 0 ? `${coef(v.A)}x^2 ${signed(v.C)}` : quadTex(v.A, v.B, v.C)),
      (i) => ({ value: { A, B: B + i, C }, note: "Arithmetic slip in the middle term." }),
    );
    return mcq(
      `Which expression is equivalent to ${m(`${bin(a, b)}${bin(c, d)}`)}?`,
      built,
      [
        `Multiply every term of the first binomial by every term of the second:`,
        ``,
        `- ${m(`${coef(a)}x \\cdot ${coef(c)}x = ${coef(A)}x^2`)}`,
        `- Outer + inner: ${m(`${a * d}x ${signed(b * c)}x = ${B}x`)}`,
        `- Last: ${m(`(${b})(${d}) = ${C}`)}`,
        ``,
        `Result: ${m(quadTex(A, B, C))}.`,
      ].join("\n"),
      params,
    );
  },
  check(p, v) {
    // Compare polynomial values at several x
    return [-2, 0, 1, 3].every(
      (x) => (p.a * x + p.b) * (p.c * x + p.d) === v.A * x * x + v.B * x + v.C,
    );
  },
};

export const polynomialRemainder: Generator = {
  id: "polynomial-remainder",
  title: "Remainder theorem",
  skill: "equivalent-expressions",
  difficulties: [3],
  generate(rng) {
    const a = randInt(rng, -6, 6);
    const b = randInt(rng, -9, 9);
    const c = randInt(rng, -12, 12);
    const k = randNonZero(rng, -3, 3);
    const p = (x: number) => x ** 3 + a * x * x + b * x + c;
    const ans = p(k);
    const params = { a, b, c, k };
    let poly = "x^3";
    if (a) poly += ` ${a < 0 ? "-" : "+"} ${coef(Math.abs(a))}x^2`;
    if (b) poly += ` ${b < 0 ? "-" : "+"} ${coef(Math.abs(b))}x`;
    if (c) poly += ` ${signed(c)}`;
    return spr(
      `What is the remainder when ${m(`p(x) = ${poly}`)} is divided by ${m(`x ${signed(-k)}`)}?`,
      ratText(ans),
      [
        `By the **remainder theorem**, dividing ${m("p(x)")} by ${m("x - k")} leaves remainder ${m("p(k)")}.`,
        ``,
        `Here ${m(`x ${signed(-k)} = x - (${k})`)}, so ${m(`k = ${k}`)}:`,
        ``,
        `$$p(${k}) = (${k})^3 ${signed(a)}(${k})^2 ${signed(b)}(${k}) ${signed(c)} = ${ans}$$`,
      ].join("\n"),
      ans,
      params,
    );
  },
  check(pr, v: number) {
    // Synthetic division
    const coeffs = [1, pr.a, pr.b, pr.c];
    let acc = 0;
    for (const co of coeffs) acc = acc * pr.k + co;
    return v === acc;
  },
};

export const advancedGenerators: Generator[] = [
  quadraticRoots,
  quadraticVertex,
  exponentialModel,
  functionEval,
  functionComposition,
  binomialProduct,
  polynomialRemainder,
];
