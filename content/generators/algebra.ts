import {
  approxEqual,
  buildMcq,
  coef,
  type Generator,
  linTex,
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

const D = "\\$"; // escaped dollar sign for Markdown with math

/** "Subtract 5 from both sides" / "Add 5 to both sides" for removing +b. */
function removeConst(b: number): string {
  return b >= 0 ? `Subtract ${m(b)} from both sides` : `Add ${m(-b)} to both sides`;
}

/** LaTeX for a line y = mx + b with rational m and b. */
export function lineTex(slope: number, b: number): string {
  let s: string;
  if (slope === 0) s = "";
  else if (slope === 1) s = "x";
  else if (slope === -1) s = "-x";
  else s = `${ratTex(slope)}x`;
  if (b === 0) return `y = ${s || "0"}`;
  if (!s) return `y = ${ratTex(b)}`;
  return `y = ${s} ${b < 0 ? "-" : "+"} ${ratTex(Math.abs(b))}`;
}

function termXY(a: number, b: number): string {
  const bAbs = Math.abs(b);
  return `${coef(a)}x ${b < 0 ? "-" : "+"} ${coef(bAbs)}y`;
}

export const linearEquation: Generator = {
  id: "linear-equation",
  title: "Solve a linear equation in one variable",
  skill: "linear-equations-one-var",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const a = randInt(rng, 2, 9);
      const x0 = randInt(rng, -10, 12);
      const b = randNonZero(rng, -20, 20);
      const c = a * x0 + b;
      const params = { kind: "ax+b=c", a, b, c };
      const built = buildMcq(
        rng,
        x0,
        [
          { value: (c + b) / a, note: `Moved ${m(b)} to the other side without changing its sign.` },
          { value: c - b, note: `Isolated ${m(`${a}x`)} but forgot to divide both sides by ${m(a)}.` },
          { value: c / a - b, note: `Divided only ${m(c)} by ${m(a)} instead of dividing the whole side ${m(c - b)}.` },
        ],
        (v) => m(ratTex(v)),
        (i) => ({ value: x0 + (i % 2 ? i : -i), note: "Arithmetic slip while solving." }),
      );
      return mcq(
        `If ${m(`${linTex(a, b)} = ${c}`)}, what is the value of ${m("x")}?`,
        built,
        [
          `1. ${removeConst(b)}: ${m(`${a}x = ${c - b}`)}.`,
          `2. Divide both sides by ${m(a)}: ${m(`x = ${x0}`)}.`,
          ``,
          `Check: ${m(`${a}(${x0}) ${signed(b)} = ${c}`)}. ✓`,
        ].join("\n"),
        params,
      );
    }
    if (difficulty === 2) {
      const a = randInt(rng, 2, 7);
      let c = randInt(rng, 1, 9);
      while (c === a) c = randInt(rng, 1, 9);
      const b = randNonZero(rng, -9, 9);
      const x0 = randInt(rng, -8, 10);
      const d = a * (x0 + b) - c * x0;
      const params = { kind: "a(x+b)=cx+d", a, b, c, d };
      const built = buildMcq(
        rng,
        x0,
        [
          { value: (d - b) / (a - c), note: `Forgot to distribute ${m(a)} to the ${m(b)} inside the parentheses.` },
          { value: (d - a * b) / (a + c), note: `Added ${m(`${c}x`)} to the left side instead of subtracting it.` },
          { value: (d + a * b) / (a - c), note: `Sign error when moving ${m(a * b)} to the right side.` },
        ],
        (v) => m(ratTex(v)),
        (i) => ({ value: x0 + (i % 2 ? i : -i), note: "Arithmetic slip while solving." }),
      );
      return mcq(
        `If ${m(`${a}(x ${signed(b)}) = ${linTex(c, d)}`)}, what is the value of ${m("x")}?`,
        built,
        [
          `1. Distribute: ${m(`${linTex(a, a * b)} = ${linTex(c, d)}`)}.`,
          `2. Subtract ${m(`${coef(c)}x`)} from both sides: ${m(`${linTex(a - c, a * b)} = ${d}`)}.`,
          `3. ${removeConst(a * b)}: ${m(`${coef(a - c)}x = ${d - a * b}`)}.`,
          ...(a - c === 1 ? [] : [`4. Divide by ${m(a - c)}: ${m(`x = ${x0}`)}.`]),
        ].join("\n"),
        params,
      );
    }
    // difficulty 3: x/p + x/q = r  (student-produced response)
    const p = randInt(rng, 2, 9);
    let q = randInt(rng, 2, 9);
    while (q === p) q = randInt(rng, 2, 9);
    const r = randInt(rng, 1, 10);
    const x = (r * p * q) / (p + q);
    const params = { kind: "x/p+x/q=r", p, q, r };
    return spr(
      `If ${m(`\\frac{x}{${p}} + \\frac{x}{${q}} = ${r}`)}, what is the value of ${m("x")}?`,
      ratText(x),
      [
        `1. Multiply both sides by ${m(p * q)} to clear the fractions: ${m(`${q}x + ${p}x = ${r * p * q}`)}.`,
        `2. Combine like terms: ${m(`${p + q}x = ${r * p * q}`)}.`,
        `3. Divide: ${m(`x = ${ratTex(x)}`)}.`,
        ``,
        `Any equivalent form (fraction or a decimal that fills the answer space) is accepted.`,
      ].join("\n"),
      x,
      params,
    );
  },
  check(p, v: number) {
    if (p.kind === "ax+b=c") return approxEqual(p.a * v + p.b, p.c);
    if (p.kind === "a(x+b)=cx+d") return approxEqual(p.a * (v + p.b), p.c * v + p.d);
    return approxEqual(v / p.p + v / p.q, p.r);
  },
};

const SERVICES = [
  { who: "A plumber", unit: "hour", fee: "service call fee" },
  { who: "A bike rental shop", unit: "hour", fee: "base fee" },
  { who: "A moving company", unit: "mile", fee: "booking fee" },
  { who: "A tutor", unit: "session", fee: "registration fee" },
  { who: "A storage company", unit: "month", fee: "setup fee" },
];

export const linearModel: Generator = {
  id: "linear-model",
  title: "Linear cost model (fixed fee plus rate)",
  skill: "linear-functions",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const s = pick(rng, SERVICES);
    const F = randInt(rng, 3, 12) * 5;
    let r = randInt(rng, 4, 25);
    while (r === F) r = randInt(rng, 4, 25);
    if (difficulty === 1) {
      const h = randInt(rng, 2, 12);
      const T = F + r * h;
      const params = { kind: "solve", F, r, T };
      const built = buildMcq(
        rng,
        h,
        [
          { value: T / r, note: `Divided the whole total by the rate and ignored the ${D}${F} ${s.fee}.` },
          { value: (T + F) / r, note: `Added the ${s.fee} to the total instead of subtracting it.` },
          { value: T - F - r, note: `Subtracted the rate instead of dividing by it.` },
        ],
        (v) => m(ratTex(v)),
        (i) => ({ value: h + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `${s.who} charges a ${s.fee} of ${D}${F} plus ${D}${r} per ${s.unit}. A customer paid a total of ${D}${T}. For how many ${s.unit}s was the customer charged?`,
        built,
        [
          `The total cost is the fee plus ${m(r)} times the number of ${s.unit}s, ${m("n")}:`,
          ``,
          `$$${F} + ${r}n = ${T}$$`,
          ``,
          `1. Subtract ${m(F)}: ${m(`${r}n = ${T - F}`)}.`,
          `2. Divide by ${m(r)}: ${m(`n = ${h}`)}.`,
        ].join("\n"),
        params,
      );
    }
    const params = { kind: "model", F, r };
    const built = buildMcq(
      rng,
      { int: F, slope: r },
      [
        { value: { int: r, slope: F }, note: "Swapped the fixed fee and the per-unit rate." },
        { value: { int: 0, slope: F + r }, note: `Charged the ${s.fee} again for every ${s.unit}.` },
        { value: { int: -F, slope: r }, note: `Subtracted the ${s.fee} instead of adding it.` },
      ],
      (v) => m(`C = ${v.int === 0 ? `${v.slope}n` : v.int > 0 ? `${v.int} + ${v.slope}n` : `${v.slope}n - ${-v.int}`}`),
      (i) => ({ value: { int: F + i, slope: r }, note: "Wrong fixed fee." }),
    );
    return mcq(
      `${s.who} charges a ${s.fee} of ${D}${F} plus ${D}${r} per ${s.unit}. Which equation gives the total cost ${m("C")}, in dollars, for ${m("n")} ${s.unit}s?`,
      built,
      [
        `The ${s.fee} is paid once, so it is the constant term: ${m(F)}.`,
        `Each ${s.unit} adds ${D}${r}, so ${m("n")} ${s.unit}s add ${m(`${r}n`)}.`,
        ``,
        `Together: ${m(`C = ${F} + ${r}n`)}.`,
      ].join("\n"),
      params,
    );
  },
  check(p, v) {
    if (p.kind === "solve") return approxEqual(p.F + p.r * v, p.T);
    // model: predictions must match for several n
    return [0, 1, 2, 5].every((n) => approxEqual(v.int + v.slope * n, p.F + p.r * n));
  },
};

export const linearFromPoints: Generator = {
  id: "linear-from-points",
  title: "Evaluate a linear function from two values",
  skill: "linear-functions",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const slope = difficulty === 2 ? randNonZero(rng, -6, 6) : randNonZero(rng, -9, 9) / 2;
    const k = randInt(rng, -10, 10);
    const a = randInt(rng, -4, 3);
    const b = a + randInt(rng, 1, 5) * (difficulty === 3 ? 2 : 1);
    let c = randInt(rng, -6, 12);
    while (c === a || c === b) c = randInt(rng, -6, 12);
    const f = (x: number) => slope * x + k;
    const [p, q, fc] = [f(a), f(b), f(c)];
    const params = { a, p, b, q, c };
    const stem = `For the linear function ${m("f")}, ${m(`f(${a}) = ${ratTex(p)}`)} and ${m(`f(${b}) = ${ratTex(q)}`)}. What is the value of ${m(`f(${c})`)}?`;
    const explanation = [
      `1. Slope: ${m(`\\dfrac{${ratTex(q)} - (${ratTex(p)})}{${b} - (${a})} = ${ratTex(slope)}`)}.`,
      `2. Move from ${m(`x = ${a}`)} to ${m(`x = ${c}`)}: ${m(`f(${c}) = f(${a}) + ${ratTex(slope)}\\,(${c} - (${a}))`)}.`,
      `3. ${m(`f(${c}) = ${ratTex(p)} + ${ratTex(slope * (c - a))} = ${ratTex(fc)}`)}.`,
    ].join("\n");
    if (difficulty === 3) return spr(stem, ratText(fc), explanation, fc, params);
    const built = buildMcq(
      rng,
      fc,
      [
        { value: p + (c - a) / slope, note: "Used run over rise (the reciprocal of the slope)." },
        { value: slope * c, note: "Multiplied the slope by the input but left out the y-intercept." },
        { value: p + slope * c, note: `Added ${m(`${ratTex(slope)}\\cdot ${c}`)} to ${m(`f(${a})`)} without accounting for the starting point ${m(`x = ${a}`)}.` },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: fc + (i % 2 ? i : -i), note: "Arithmetic slip." }),
    );
    return mcq(stem, built, explanation, params);
  },
  check(pr, v: number) {
    // Three points on a line are collinear.
    return approxEqual((pr.q - pr.p) * (pr.c - pr.a), (v - pr.p) * (pr.b - pr.a));
  },
};

export const lineThroughPoints: Generator = {
  id: "line-through-points",
  title: "Equation of the line through two points",
  skill: "linear-equations-two-var",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const rise = randNonZero(rng, -6, 6);
    const run = difficulty === 1 ? 1 : pick(rng, [2, 3, 4]);
    const slope = rise / run;
    const x1 = randInt(rng, -5, 5);
    const y1 = randInt(rng, -8, 8);
    const steps = randInt(rng, 1, 3);
    const x2 = x1 + run * steps;
    const y2 = y1 + rise * steps;
    const b = y1 - slope * x1;
    const params = { x1, y1, x2, y2 };
    const built = buildMcq(
      rng,
      { slope, b },
      [
        { value: { slope: 1 / slope, b: y1 - x1 / slope }, note: "Computed the slope as run over rise." },
        { value: { slope, b: -b }, note: "Sign error when solving for the y-intercept." },
        { value: { slope: -slope, b: y1 + slope * x1 }, note: "Subtracted the coordinates in opposite orders, which flips the sign of the slope." },
        { value: { slope, b: y1 }, note: `Used ${m(y1)} as the y-intercept, but that point has ${m(`x = ${x1}`)}, not ${m("x = 0")}.` },
      ],
      (v) => m(lineTex(v.slope, v.b)),
      (i) => ({ value: { slope, b: b + i }, note: "Wrong y-intercept." }),
    );
    return mcq(
      `A line in the ${m("xy")}-plane passes through the points ${m(`(${x1}, ${y1})`)} and ${m(`(${x2}, ${y2})`)}. Which equation defines the line?`,
      built,
      [
        `1. Slope: ${m(`m = \\dfrac{${y2} - (${y1})}{${x2} - (${x1})} = \\dfrac{${y2 - y1}}{${x2 - x1}} = ${ratTex(slope)}`)}.`,
        `2. Substitute a point into ${m("y = mx + b")}: ${m(`${y1} = ${ratTex(slope)}(${x1}) + b`)}, so ${m(`b = ${ratTex(b)}`)}.`,
        `3. The line is ${m(lineTex(slope, b))}.`,
      ].join("\n"),
      params,
    );
  },
  check(p, v) {
    return approxEqual(p.y1, v.slope * p.x1 + v.b) && approxEqual(p.y2, v.slope * p.x2 + v.b);
  },
};

function cramer(a: number, b: number, e: number, c: number, d: number, f: number) {
  const det = a * d - b * c;
  return { x: (e * d - b * f) / det, y: (a * f - e * c) / det };
}

export const linearSystem: Generator = {
  id: "linear-system",
  title: "Solve a system of two linear equations",
  skill: "systems-linear",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    const x0 = randInt(rng, -6, 8);
    const y0 = randInt(rng, -6, 8);
    let a: number, b: number, c: number, d: number;
    if (difficulty === 3) {
      // Symmetric coefficients: adding the equations gives (a + b)(x + y).
      for (;;) {
        a = randInt(rng, 2, 9);
        b = randNonZero(rng, -7, 9);
        if (a + b !== 0 && Math.abs(a) !== Math.abs(b)) break;
      }
      c = b;
      d = a;
    } else {
      for (;;) {
        a = randNonZero(rng, -5, 6);
        b = difficulty === 1 ? pick(rng, [1, -1]) : randNonZero(rng, -5, 6);
        c = randNonZero(rng, -5, 6);
        d = randNonZero(rng, -5, 6);
        if (a * d - b * c !== 0) break;
      }
    }
    const e = a * x0 + b * y0;
    const f = c * x0 + d * y0;
    const system = `$$\n\\begin{aligned}\n${termXY(a, b)} &= ${e}\\\\\n${termXY(c, d)} &= ${f}\n\\end{aligned}\n$$`;
    const target = difficulty === 1 ? "x" : difficulty === 2 ? "y" : "x+y";
    const params = { a, b, e, c, d, f, target };
    if (difficulty === 3) {
      const s = x0 + y0;
      return spr(
        `${system}\n\nIf ${m("(x, y)")} is the solution to the system of equations above, what is the value of ${m("x + y")}?`,
        String(s),
        [
          `The coefficients are "swapped" between the two equations, so add the equations:`,
          ``,
          `$$${a + b}x + ${a + b}y = ${e + f}$$`,
          ``,
          `Divide both sides by ${m(a + b)}: ${m(`x + y = ${s}`)}. You never need ${m("x")} and ${m("y")} separately (they are ${m(x0)} and ${m(y0)}).`,
        ].join("\n"),
        s,
        params,
      );
    }
    const explanation = [
      `Use elimination (substitution works too).`,
      ``,
      `1. Multiply the first equation by ${m(d)} and the second by ${m(b)}, then subtract to eliminate ${m("y")}: ${m(`(${a * d} - ${b * c})x = ${e * d} - ${b * f}`)}, so ${m(`x = ${x0}`)}.`,
      `2. Substitute into the first equation: ${m(`${a}(${x0}) ${b < 0 ? "-" : "+"} ${Math.abs(b)}y = ${e}`)}, so ${m(`y = ${y0}`)}.`,
      ``,
      `The solution is ${m(`(${x0}, ${y0})`)}.`,
    ].join("\n");
    if (difficulty === 2) {
      return spr(
        `${system}\n\nThe solution to the system of equations above is ${m("(x, y)")}. What is the value of ${m("y")}?`,
        String(y0),
        explanation,
        y0,
        params,
      );
    }
    const built = buildMcq(
      rng,
      x0,
      [
        { value: y0, note: `This is the value of ${m("y")}, not ${m("x")}.` },
        { value: -x0, note: "Sign error during elimination." },
        { value: x0 + y0, note: `This is ${m("x + y")}.` },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: x0 + (i % 2 ? i : -i), note: "Arithmetic slip." }),
    );
    return mcq(
      `${system}\n\nThe solution to the system of equations above is ${m("(x, y)")}. What is the value of ${m("x")}?`,
      built,
      explanation,
      params,
    );
  },
  check(p, v: number) {
    const { x, y } = cramer(p.a, p.b, p.e, p.c, p.d, p.f);
    const want = p.target === "x" ? x : p.target === "y" ? y : x + y;
    return approxEqual(v, want);
  },
};

export const linearInequality: Generator = {
  id: "linear-inequality",
  title: "Greatest or least integer solution of a linear inequality",
  skill: "linear-inequalities",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const a = difficulty === 1 ? randInt(rng, 2, 7) : -randInt(rng, 2, 7);
    const b = randNonZero(rng, -15, 15);
    const c = randInt(rng, -20, 30);
    const strict = rng() < 0.5;
    const t = (c - b) / a;
    let ans: number;
    if (a > 0) ans = strict ? (Number.isInteger(t) ? t - 1 : Math.floor(t)) : Math.floor(t);
    else ans = strict ? (Number.isInteger(t) ? t + 1 : Math.ceil(t)) : Math.ceil(t);
    const word = a > 0 ? "greatest" : "least";
    const op = strict ? "<" : "\\le";
    const params = { a, b, c, strict, want: word };
    const flip = a > 0 ? (strict ? "<" : "\\le") : strict ? ">" : "\\ge";
    const explanation = [
      `1. ${removeConst(b)}: ${m(`${a}x ${op} ${c - b}`)}.`,
      `2. Divide by ${m(a)}${a < 0 ? " — dividing by a negative number **reverses** the inequality sign" : ""}: ${m(`x ${flip} ${ratTex(t)}`)}.`,
      `3. The ${word} integer satisfying this is ${m(ans)}.`,
    ].join("\n");
    const stem = `What is the ${word} integer ${m("x")} that satisfies ${m(`${linTex(a, b)} ${op} ${c}`)}?`;
    if (difficulty === 2) return spr(stem, String(ans), explanation, ans, params);
    const boundary = strict && Number.isInteger(t) ? t : Math.ceil(t);
    const built = buildMcq(
      rng,
      ans,
      [
        { value: boundary, note: strict && Number.isInteger(t) ? "The boundary value itself does not satisfy a strict inequality." : "Rounded the boundary up; that value is outside the solution set." },
        { value: Math.floor((c + b) / a), note: `Moved ${m(b)} across without changing its sign.` },
        { value: ans - 1, note: "Satisfies the inequality but is not the greatest integer that does." },
      ],
      (v) => m(v),
      (i) => ({ value: ans + i + 1, note: "Does not satisfy the inequality." }),
    );
    return mcq(stem, built, explanation, params);
  },
  check(p, v: number) {
    if (!Number.isInteger(v)) return false;
    const ok = (x: number) => (p.strict ? p.a * x + p.b < p.c : p.a * x + p.b <= p.c);
    if (!ok(v)) return false;
    return p.want === "greatest" ? !ok(v + 1) : !ok(v - 1);
  },
};

export const algebraGenerators: Generator[] = [
  linearEquation,
  linearModel,
  linearFromPoints,
  lineThroughPoints,
  linearSystem,
  linearInequality,
];
