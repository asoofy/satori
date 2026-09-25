import {
  approxEqual,
  buildMcq,
  clean,
  gcd,
  type Generator,
  m,
  mcq,
  pick,
  randInt,
  ratTex,
  ratText,
  shuffle,
  spr,
} from "./_lib";

const D = "\\$";

/** Plain-text money (outside math), e.g. 1,234.50 */
function moneyText(n: number): string {
  const [i, d] = clean(n, 2).toFixed(2).split(".");
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return d === "00" ? withCommas : `${withCommas}.${d}`;
}

/** Decimal answer key for SPR (trims trailing zeros). */
function decText(n: number): string {
  return String(clean(n, 4));
}

export const percentChange: Generator = {
  id: "percent-change",
  title: "Percent increase and decrease",
  skill: "percentages",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const N = randInt(rng, 2, 40) * 20;
      const p = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
      const ans = (N * (100 + p)) / 100;
      return spr(
        `A number ${m("n")} is ${m(`${p}\\%`)} greater than ${m(N)}. What is the value of ${m("n")}?`,
        decText(ans),
        [
          `"${p}% greater than ${N}" means ${N} plus ${p}% of ${N}:`,
          ``,
          `$$n = ${N}\\left(1 + \\frac{${p}}{100}\\right) = ${N}(${clean(1 + p / 100, 4)}) = ${ans}$$`,
        ].join("\n"),
        ans,
        { kind: "increase", N, p },
      );
    }
    if (difficulty === 2) {
      const P = randInt(rng, 2, 30) * 100;
      const p = pick(rng, [10, 20, 25, 30, 40, 50]);
      let q = pick(rng, [10, 20, 25, 30, 40, 50]);
      while (q === p) q = pick(rng, [10, 20, 25, 30, 40, 50]);
      const ans = (P * (100 + p) * (100 - q)) / 10000;
      const item = pick(rng, ["a jacket", "a bicycle", "a laptop", "a guitar", "a sofa"]);
      const built = buildMcq(
        rng,
        ans,
        [
          { value: (P * (100 + p - q)) / 100, note: `Combined the changes into a single ${p - q}% change. The ${q}% decrease applies to the already-increased price, so the percents can't just be added.` },
          { value: (P * (100 - p) * (100 + q)) / 10000, note: "Applied a decrease of the first percent and an increase of the second — the directions are reversed." },
          { value: (P * (100 + p)) / 100, note: `This is the price after the ${p}% increase only.` },
        ],
        (v) => `${D}${moneyText(v)}`,
        (i) => ({ value: ans + i * 10, note: "Arithmetic slip." }),
      );
      return mcq(
        `The original price of ${item} was ${D}${moneyText(P)}. The price was increased by ${p}%, and then the new price was decreased by ${q}%. What is the final price?`,
        built,
        [
          `Apply each change as a multiplier:`,
          ``,
          `- Increase ${p}%: multiply by ${m(clean(1 + p / 100, 4))}.`,
          `- Decrease ${q}%: multiply by ${m(clean(1 - q / 100, 4))}.`,
          ``,
          `$$${P} \\times ${clean(1 + p / 100, 4)} \\times ${clean(1 - q / 100, 4)} = ${clean(ans, 2)}$$`,
          ``,
          `The final price is ${D}${moneyText(ans)}.`,
        ].join("\n"),
        { kind: "successive", P, p, q },
      );
    }
    const p = pick(rng, [10, 20, 25, 40, 50, 60]);
    const O = randInt(rng, 2, 40) * 20;
    const N = (O * (100 + p)) / 100;
    const built = buildMcq(
      rng,
      O,
      [
        { value: (N * (100 - p)) / 100, note: `Took ${p}% off the new amount. But the ${p}% was a percent of the *original*, not of ${N}.` },
        { value: N - p, note: `Subtracted ${p} instead of ${p}%.` },
        { value: (N * 100) / p, note: `Divided by ${m(clean(p / 100, 4))} instead of by ${m(clean(1 + p / 100, 4))}.` },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: O + i * 5, note: "Arithmetic slip." }),
    );
    return mcq(
      `After a ${p}% increase, the number of visitors to a museum was ${m(N)}. What was the number of visitors before the increase?`,
      built,
      [
        `If the original number is ${m("x")}, then ${m(`x(1 + ${clean(p / 100, 4)}) = ${N}`)}.`,
        ``,
        `$$x = \\frac{${N}}{${clean(1 + p / 100, 4)}} = ${O}$$`,
        ``,
        `Check: ${m(`${O} + ${clean(p / 100, 4)}(${O}) = ${N}`)}. ✓`,
      ].join("\n"),
      { kind: "reverse", N, p },
    );
  },
  check(pr, v: number) {
    if (pr.kind === "increase") return approxEqual(v, pr.N + (pr.N * pr.p) / 100);
    if (pr.kind === "successive") {
      const up = pr.P + (pr.P * pr.p) / 100;
      return approxEqual(v, up - (up * pr.q) / 100);
    }
    return approxEqual(v + (v * pr.p) / 100, pr.N);
  },
};

const RECIPES = [
  { a: "cups of flour", b: "cups of sugar" },
  { a: "ounces of juice concentrate", b: "ounces of water" },
  { a: "tablespoons of lemon juice", b: "cups of water" },
  { a: "grams of salt", b: "liters of broth" },
];

export const ratioProportion: Generator = {
  id: "ratio-proportion",
  title: "Ratios and proportions",
  skill: "ratios-rates-units",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const r = pick(rng, RECIPES);
      const a = randInt(rng, 2, 9);
      let b = randInt(rng, 2, 9);
      while (b === a) b = randInt(rng, 2, 9);
      const c = b * randInt(rng, 2, 6);
      const ans = (a * c) / b;
      const built = buildMcq(
        rng,
        ans,
        [
          { value: (b * c) / a, note: "Set up the proportion upside down." },
          { value: a + (c - b), note: "Added the same amount instead of scaling by the same factor. Ratios are multiplicative." },
          { value: a * c, note: `Multiplied by ${m(c)} but forgot to divide by ${m(b)}.` },
        ],
        (v) => m(ratTex(v)),
        (i) => ({ value: ans + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `A recipe uses ${m(a)} ${r.a} for every ${m(b)} ${r.b}. How many ${r.a} are needed for ${m(c)} ${r.b}?`,
        built,
        [
          `Set up a proportion with the same order on both sides:`,
          ``,
          `$$\\frac{${a}}{${b}} = \\frac{x}{${c}}$$`,
          ``,
          `Cross-multiply: ${m(`${b}x = ${a * c}`)}, so ${m(`x = ${ratTex(ans)}`)}.`,
        ].join("\n"),
        { kind: "recipe", a, b, c },
      );
    }
    const a = randInt(rng, 2, 9);
    let b = randInt(rng, 2, 9);
    while (b === a || gcd(a, b) !== 1) b = randInt(rng, 2, 9);
    const T = (a + b) * randInt(rng, 3, 20);
    const ans = (T * b) / (a + b);
    const [g1, g2] = pick(rng, [["seniors", "juniors"], ["red marbles", "blue marbles"], ["fiction books", "nonfiction books"]]);
    return spr(
      `The ratio of ${g1} to ${g2} in a group is ${m(`${a} : ${b}`)}. There are ${m(T)} ${g1} and ${g2} in total. How many ${g2} are there?`,
      String(ans),
      [
        `The ratio ${m(`${a}:${b}`)} splits the total into ${m(`${a} + ${b} = ${a + b}`)} equal parts.`,
        ``,
        `1. One part: ${m(`${T} \\div ${a + b} = ${T / (a + b)}`)}.`,
        `2. ${g2[0].toUpperCase() + g2.slice(1)} make up ${m(b)} parts: ${m(`${b} \\times ${T / (a + b)} = ${ans}`)}.`,
      ].join("\n"),
      ans,
      { kind: "parts", a, b, T },
    );
  },
  check(p, v: number) {
    if (p.kind === "recipe") return approxEqual(v / p.c, p.a / p.b);
    return approxEqual((p.T - v) / v, p.a / p.b);
  },
};

export const unitConversion: Generator = {
  id: "unit-conversion",
  title: "Rates and unit conversion",
  skill: "ratios-rates-units",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    if (difficulty === 2) {
      const v = randInt(rng, 1, 12) * 5;
      const ans = clean(v * 3.6, 4);
      const built = buildMcq(
        rng,
        ans,
        [
          { value: clean((v * 1000) / 3600, 4), note: "Multiplied by 1,000 and divided by 3,600 — the conversion factors are upside down." },
          { value: clean((v * 60) / 1000, 4), note: "Converted seconds to minutes instead of to hours." },
          { value: v * 3600, note: "Converted seconds to hours but left the distance in meters." },
        ],
        (x) => m(String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}")),
        (i) => ({ value: ans + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `A drone flies at a constant speed of ${m(v)} meters per second. What is this speed in kilometers per hour?`,
        built,
        [
          `Multiply by conversion factors so the units cancel:`,
          ``,
          `$$${v}\\,\\frac{\\text{m}}{\\text{s}} \\times \\frac{3600\\,\\text{s}}{1\\,\\text{h}} \\times \\frac{1\\,\\text{km}}{1000\\,\\text{m}} = ${ans}\\,\\frac{\\text{km}}{\\text{h}}$$`,
        ].join("\n"),
        { kind: "mps", v },
      );
    }
    const mpg = randInt(rng, 18, 40);
    const G = randInt(rng, 8, 15);
    const M = mpg * G;
    const D2 = mpg * randInt(rng, 3, 12);
    const price = randInt(rng, 250, 480) / 100;
    const ans = clean((D2 / mpg) * price, 2);
    return spr(
      `A car traveled ${m(M)} miles using ${m(G)} gallons of gasoline. At this rate, how many dollars would gasoline cost for a ${m(D2)}-mile trip if gasoline costs ${D}${price.toFixed(2)} per gallon?`,
      decText(ans),
      [
        `1. Fuel efficiency: ${m(`${M} \\div ${G} = ${mpg}`)} miles per gallon.`,
        `2. Gallons needed: ${m(`${D2} \\div ${mpg} = ${D2 / mpg}`)}.`,
        `3. Cost: ${m(`${D2 / mpg} \\times ${price.toFixed(2)} = ${ans}`)} dollars.`,
      ].join("\n"),
      ans,
      { kind: "fuel", M, G, D: D2, price },
    );
  },
  check(p, v: number) {
    if (p.kind === "mps") return approxEqual((v * 1000) / 3600, p.v);
    return approxEqual((v / p.price) * (p.M / p.G), p.D, 1e-3);
  },
};

export const meanMedian: Generator = {
  id: "mean-median",
  title: "Mean and median",
  skill: "one-var-data",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const n = randInt(rng, 5, 7);
      const mean = randInt(rng, 8, 40);
      const vals: number[] = [];
      for (let i = 0; i < n - 1; i++) vals.push(mean + randInt(rng, -7, 7));
      vals.push(mean * n - vals.reduce((s, x) => s + x, 0));
      if (vals[n - 1] <= 0) vals[n - 1] = mean; // extremely unlikely; keeps values positive
      const sum = vals.reduce((s, x) => s + x, 0);
      const ans = sum / n;
      const list = shuffle(rng, vals);
      return spr(
        `What is the mean of the data set ${m(list.join(",\\ "))}?`,
        ratText(ans),
        [
          `The mean is the sum divided by the number of values.`,
          ``,
          `$$\\frac{${list.join(" + ")}}{${n}} = \\frac{${sum}}{${n}} = ${ratTex(ans)}$$`,
        ].join("\n"),
        ans,
        { kind: "mean", list },
      );
    }
    if (difficulty === 2) {
      const n = randInt(rng, 4, 9);
      const M = randInt(rng, 10, 30);
      // pick the new mean directly so the added value is an integer
      const shift = randInt(rng, 1, 6) * (rng() < 0.7 ? 1 : -1);
      const M2 = M + shift;
      const added = M2 * (n + 1) - M * n;
      const built = buildMcq(
        rng,
        added,
        [
          { value: M2 * (n + 1), note: "This is the new total, not the added value." },
          { value: M2 + (M2 - M), note: "Assumed the new value moves the mean by the same amount it is above the mean — that ignores how many values there are." },
          { value: (M2 - M) * n, note: "Found how much the total had to grow for the first n values, but forgot the new value also has to reach the new mean." },
        ],
        (v) => m(v),
        (i) => ({ value: added + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `The mean of ${m(n)} numbers is ${m(M)}. When one more number is added to the list, the mean of all ${m(n + 1)} numbers is ${m(M2)}. What number was added?`,
        built,
        [
          `Work with totals, since mean × count = total.`,
          ``,
          `1. Original total: ${m(`${n} \\times ${M} = ${M * n}`)}.`,
          `2. New total: ${m(`${n + 1} \\times ${M2} = ${M2 * (n + 1)}`)}.`,
          `3. Added number: ${m(`${M2 * (n + 1)} - ${M * n} = ${added}`)}.`,
        ].join("\n"),
        { kind: "added", n, M, M2 },
      );
    }
    // Frequency table median (odd total so the median is a single value)
    const base = randInt(rng, 0, 10);
    const vals = [1, 2, 3, 4, 5].map((v) => v + base);
    let freqs: number[];
    for (;;) {
      freqs = vals.map(() => randInt(rng, 1, 9));
      const total = freqs.reduce((s, f) => s + f, 0);
      if (total % 2 === 1) break;
    }
    const expanded = vals.flatMap((v, i) => Array(freqs[i]).fill(v) as number[]);
    const total = expanded.length;
    const median = expanded[(total - 1) / 2];
    const mean = expanded.reduce((s, x) => s + x, 0) / total;
    const mode = vals[freqs.indexOf(Math.max(...freqs))];
    const table = [`| Value | Frequency |`, `|---|---|`, ...vals.map((v, i) => `| ${v} | ${freqs[i]} |`)].join("\n");
    const built = buildMcq(
      rng,
      median,
      [
        { value: vals[2], note: "This is the middle row of the table, but the median depends on the frequencies too." },
        { value: mode, note: "This is the mode (most frequent value), not the median." },
        { value: clean(mean, 2), note: "This is the (rounded) mean, not the median." },
      ],
      (v) => m(v),
      (i) => ({ value: median + i, note: "Counted to the wrong position." }),
    );
    return mcq(
      `The frequency table summarizes a data set of ${m(total)} values.\n\n${table}\n\nWhat is the median of the data set?`,
      built,
      [
        `With ${m(total)} values, the median is the ${m(`\\frac{${total}+1}{2} = ${(total + 1) / 2}`)}th value in order.`,
        ``,
        `Count up the frequencies: ${vals.map((v, i) => `${v} → values ${freqs.slice(0, i).reduce((s, f) => s + f, 0) + 1}–${freqs.slice(0, i + 1).reduce((s, f) => s + f, 0)}`).join("; ")}.`,
        ``,
        `The ${(total + 1) / 2}th value is ${m(median)}.`,
      ].join("\n"),
      { kind: "freq", vals, freqs },
    );
  },
  check(p, v: number) {
    if (p.kind === "mean") return approxEqual(v * p.list.length, p.list.reduce((s: number, x: number) => s + x, 0));
    if (p.kind === "added") return approxEqual((p.M * p.n + v) / (p.n + 1), p.M2);
    const expanded: number[] = p.vals.flatMap((val: number, i: number) => Array(p.freqs[i]).fill(val));
    expanded.sort((a, b) => a - b);
    const mid = expanded.length / 2;
    const med = expanded.length % 2 ? expanded[Math.floor(mid)] : (expanded[mid - 1] + expanded[mid]) / 2;
    return v === med;
  },
};

const TABLES = [
  { rows: ["Grade 10", "Grade 11"], cols: ["Chose art", "Chose music"], who: "student" },
  { rows: ["Morning shift", "Evening shift"], cols: ["Drives to work", "Takes transit"], who: "employee" },
  { rows: ["Plot A", "Plot B"], cols: ["Flowered", "Did not flower"], who: "plant" },
  { rows: ["Under 30", "30 or older"], cols: ["Prefers email", "Prefers text"], who: "survey respondent" },
];

export const twoWayProbability: Generator = {
  id: "two-way-probability",
  title: "Conditional probability from a two-way table",
  skill: "probability",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const t = pick(rng, TABLES);
    const n = [
      [randInt(rng, 5, 40), randInt(rng, 5, 40)],
      [randInt(rng, 5, 40), randInt(rng, 5, 40)],
    ];
    const rowT = [n[0][0] + n[0][1], n[1][0] + n[1][1]];
    const colT = [n[0][0] + n[1][0], n[0][1] + n[1][1]];
    const total = rowT[0] + rowT[1];
    const r = randInt(rng, 0, 1);
    const c = randInt(rng, 0, 1);
    const table = [
      `| | ${t.cols[0]} | ${t.cols[1]} | Total |`,
      `|---|---|---|---|`,
      `| ${t.rows[0]} | ${n[0][0]} | ${n[0][1]} | ${rowT[0]} |`,
      `| ${t.rows[1]} | ${n[1][0]} | ${n[1][1]} | ${rowT[1]} |`,
      `| Total | ${colT[0]} | ${colT[1]} | ${total} |`,
    ].join("\n");
    const lower = (s: string) => s[0].toLowerCase() + s.slice(1);
    if (difficulty === 3) {
      // condition on the column
      const ans = n[r][c] / colT[c];
      return spr(
        `The table shows data for ${m(total)} people in a study.\n\n${table}\n\nIf a ${t.who} is selected at random from those in the "${t.cols[c]}" group, what is the probability that the ${t.who} is in the "${t.rows[r]}" group? (Express your answer as a fraction or a decimal.)`,
        ratText(ans),
        [
          `The condition "from those in ${lower(t.cols[c])}" restricts the sample to that column, which has ${m(colT[c])} people.`,
          ``,
          `Of those, ${m(n[r][c])} are in "${t.rows[r]}".`,
          ``,
          `$$P = \\frac{${n[r][c]}}{${colT[c]}}${ans !== n[r][c] / colT[c] ? "" : ` = ${ratTex(ans)}`}$$`,
        ].join("\n"),
        ans,
        { n, r, c, given: "col" },
      );
    }
    const ans = n[r][c] / rowT[r];
    const built = buildMcq(
      rng,
      ans,
      [
        { value: n[r][c] / total, note: `Divided by the grand total ${m(total)}; the condition limits the group to the ${m(rowT[r])} in "${t.rows[r]}".` },
        { value: n[r][c] / colT[c], note: `Divided by the column total — that answers the reverse question (given "${t.cols[c]}").` },
        { value: rowT[r] / total, note: `This is the probability of being in "${t.rows[r]}" at all.` },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: (n[r][c] + i) / rowT[r], note: "Counted the wrong cell." }),
    );
    return mcq(
      `The table shows data for ${m(total)} people in a study.\n\n${table}\n\nIf a ${t.who} is selected at random from those in the "${t.rows[r]}" group, what is the probability that the ${t.who} is in the "${t.cols[c]}" group?`,
      built,
      [
        `"Selected from those in ${t.rows[r]}" means the sample space is that row: ${m(rowT[r])} people.`,
        ``,
        `Of those, ${m(n[r][c])} are in "${t.cols[c]}".`,
        ``,
        `$$P = \\frac{${n[r][c]}}{${rowT[r]}} = ${ratTex(ans)}$$`,
      ].join("\n"),
      { n, r, c, given: "row" },
    );
  },
  check(p, v: number) {
    const cell = p.n[p.r][p.c];
    const denom = p.given === "row" ? p.n[p.r][0] + p.n[p.r][1] : p.n[0][p.c] + p.n[1][p.c];
    return approxEqual(v * denom, cell);
  },
};

export const sampleEstimate: Generator = {
  id: "sample-estimate",
  title: "Estimate a population total from a sample",
  skill: "sample-statistics",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const n = pick(rng, [40, 50, 80, 100, 120, 150, 200, 250]);
    const x = randInt(rng, 2, Math.floor(n * 0.8));
    const N = n * randInt(rng, 5, 60);
    const ans = (x / n) * N;
    const topic = pick(rng, [
      { pop: "students at a high school", trait: "said they walk to school" },
      { pop: "households in a city", trait: "own a dog" },
      { pop: "trees in a park", trait: "showed signs of a leaf disease" },
      { pop: "light bulbs produced in a day", trait: "were defective" },
    ]);
    const stem = `A random sample of ${m(n)} ${topic.pop} was selected, and ${m(x)} of them ${topic.trait}. There are ${m(N)} ${topic.pop} in total. Based on the sample, about how many of the ${topic.pop} ${topic.trait}?`;
    const explanation = [
      `A random sample is representative, so use the sample proportion for the whole population.`,
      ``,
      `$$\\frac{${x}}{${n}} \\times ${N} = ${ratTex(ans)}$$`,
    ].join("\n");
    if (difficulty === 2) return spr(stem, ratText(ans), explanation, ans, { n, x, N });
    const built = buildMcq(
      rng,
      ans,
      [
        { value: (n / x) * N, note: "Used the proportion upside down." },
        { value: N - x, note: "Subtracted the sample count from the population instead of scaling." },
        { value: x, note: "This is the number in the sample, not the estimate for the population." },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: ans + i * 10, note: "Arithmetic slip." }),
    );
    return mcq(stem, built, explanation, { n, x, N });
  },
  check(p, v: number) {
    return approxEqual(v / p.N, p.x / p.n);
  },
};

export const psdaGenerators: Generator[] = [
  percentChange,
  ratioProportion,
  unitConversion,
  meanMedian,
  twoWayProbability,
  sampleEstimate,
];
