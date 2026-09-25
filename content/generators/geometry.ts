import {
  approxEqual,
  buildMcq,
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

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

/** "kπ" in LaTeX for a rational coefficient k. */
function piTex(k: number): string {
  if (k === 1) return "\\pi";
  return `${ratTex(k)}\\pi`;
}

export const pythagorean: Generator = {
  id: "pythagorean",
  title: "Pythagorean theorem",
  skill: "right-triangles-trig",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    const [a0, b0, c0] = pick(rng, TRIPLES);
    const k = c0 > 20 ? 1 : randInt(rng, 1, 4);
    const [a, b, c] = [a0 * k, b0 * k, c0 * k];
    if (difficulty === 2) {
      return spr(
        `A right triangle has a hypotenuse of length ${m(c)} and one leg of length ${m(a)}. What is the length of the other leg?`,
        String(b),
        [
          `By the Pythagorean theorem, ${m("a^2 + b^2 = c^2")}, so ${m("b = \\sqrt{c^2 - a^2}")}.`,
          ``,
          `$$b = \\sqrt{${c}^2 - ${a}^2} = \\sqrt{${c * c} - ${a * a}} = \\sqrt{${b * b}} = ${b}$$`,
        ].join("\n"),
        b,
        { kind: "leg", a, c },
      );
    }
    const built = buildMcq(
      rng,
      c,
      [
        { value: a + b, note: "Added the legs. The hypotenuse is shorter than the sum of the legs (triangle inequality)." },
        { value: (a * b) / 2, note: "This is the triangle's area, not the length of its hypotenuse." },
        { value: a * a + b * b, note: "Forgot to take the square root at the end." },
      ],
      (v) => m(v),
      (i) => ({ value: c + i, note: "Not consistent with the Pythagorean theorem." }),
    );
    return mcq(
      `The legs of a right triangle have lengths ${m(a)} and ${m(b)}. What is the length of the hypotenuse?`,
      built,
      [
        `$$c = \\sqrt{a^2 + b^2} = \\sqrt{${a * a} + ${b * b}} = \\sqrt{${c * c}} = ${c}$$`,
      ].join("\n"),
      { kind: "hyp", a, b },
    );
  },
  check(p, v: number) {
    if (p.kind === "leg") return v > 0 && approxEqual(p.a * p.a + v * v, p.c * p.c);
    return v > 0 && approxEqual(p.a * p.a + p.b * p.b, v * v);
  },
};

export const similarTriangles: Generator = {
  id: "similar-triangles",
  title: "Similar triangles",
  skill: "lines-angles-triangles",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const p = randInt(rng, 2, 12);
    const scale = pick(rng, difficulty === 2 ? [2, 3, 4] : [1.5, 2.5, 0.5, 4 / 3, 5 / 2]);
    const q = p * scale;
    if (!Number.isInteger(q)) return similarTriangles.generate(rng, difficulty);
    const s = randInt(rng, 2, 15);
    const ans = (s * q) / p;
    const stem = `Triangle ${m("ABC")} is similar to triangle ${m("DEF")}, where ${m("A")}, ${m("B")}, and ${m("C")} correspond to ${m("D")}, ${m("E")}, and ${m("F")}, respectively. If ${m(`AB = ${p}`)}, ${m(`DE = ${q}`)}, and ${m(`BC = ${s}`)}, what is the length of ${m("EF")}?`;
    const explanation = [
      `Corresponding sides of similar triangles are proportional:`,
      ``,
      `$$\\frac{EF}{BC} = \\frac{DE}{AB} = \\frac{${q}}{${p}}$$`,
      ``,
      `So ${m(`EF = ${s} \\cdot \\frac{${q}}{${p}} = ${ratTex(ans)}`)}.`,
    ].join("\n");
    const params = { p, q, s };
    if (difficulty === 3) return spr(stem, ratText(ans), explanation, ans, params);
    const built = buildMcq(
      rng,
      ans,
      [
        { value: (s * p) / q, note: "Used the scale factor upside down (from DEF to ABC)." },
        { value: s + (q - p), note: "Added the difference of the sides instead of multiplying by the scale factor." },
        { value: s * q, note: `Multiplied by ${m(q)} but forgot to divide by ${m(p)}.` },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: ans + i, note: "Arithmetic slip." }),
    );
    return mcq(stem, built, explanation, params);
  },
  check(pr, v: number) {
    return approxEqual(v * pr.p, pr.s * pr.q);
  },
};

export const rightTriangleTrig: Generator = {
  id: "right-triangle-trig",
  title: "Sine, cosine, and tangent in a right triangle",
  skill: "right-triangles-trig",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    if (difficulty === 3) {
      const k = randInt(rng, 5, 85);
      return spr(
        `In a right triangle, one acute angle measures ${m(`x^\\circ`)} and ${m(`\\sin(x^\\circ) = \\cos(${k}^\\circ)`)}. What is the value of ${m("x")}?`,
        String(90 - k),
        [
          `The two acute angles of a right triangle are complementary, and the sine of one equals the cosine of the other: ${m("\\sin(x^\\circ) = \\cos(90^\\circ - x^\\circ)")}.`,
          ``,
          `So ${m(`90 - x = ${k}`)}, which gives ${m(`x = ${90 - k}`)}.`,
        ].join("\n"),
        90 - k,
        { kind: "cofunction", k },
      );
    }
    const [a0, b0, c0] = pick(rng, TRIPLES);
    const k = randInt(rng, 1, 3);
    const [a, b, c] = [a0 * k, b0 * k, c0 * k];
    const fn = pick(rng, ["sin", "cos", "tan"] as const);
    // BC = a is opposite A, AC = b is adjacent to A, AB = c is the hypotenuse.
    const val = { sin: a / c, cos: b / c, tan: a / b }[fn];
    const built = buildMcq(
      rng,
      val,
      [
        { value: fn === "sin" ? b / c : a / c, note: fn === "sin" ? "This is cos A (adjacent over hypotenuse)." : "This is sin A (opposite over hypotenuse)." },
        { value: fn === "tan" ? b / a : a / b, note: fn === "tan" ? "Adjacent over opposite is the reciprocal of tan A." : "This is tan A (opposite over adjacent)." },
        { value: c / (fn === "cos" ? b : a), note: "Put the hypotenuse on top; sine and cosine are always at most 1." },
      ],
      (v) => m(ratTex(v)),
      (i) => ({ value: (a + i) / c, note: "Used the wrong side length." }),
    );
    return mcq(
      `In right triangle ${m("ABC")}, angle ${m("C")} is the right angle, ${m(`BC = ${a}`)}, ${m(`AC = ${b}`)}, and ${m(`AB = ${c}`)}. What is the value of ${m(`\\${fn} A`)}?`,
      built,
      [
        `From angle ${m("A")}: the **opposite** side is ${m(`BC = ${a}`)}, the **adjacent** side is ${m(`AC = ${b}`)}, and the **hypotenuse** is ${m(`AB = ${c}`)}.`,
        ``,
        fn === "sin"
          ? `$$\\sin A = \\frac{\\text{opposite}}{\\text{hypotenuse}} = \\frac{${a}}{${c}}${k > 1 ? ` = ${ratTex(val)}` : ""}$$`
          : fn === "cos"
            ? `$$\\cos A = \\frac{\\text{adjacent}}{\\text{hypotenuse}} = \\frac{${b}}{${c}}${k > 1 ? ` = ${ratTex(val)}` : ""}$$`
            : `$$\\tan A = \\frac{\\text{opposite}}{\\text{adjacent}} = \\frac{${a}}{${b}}${k > 1 ? ` = ${ratTex(val)}` : ""}$$`,
      ].join("\n"),
      { kind: "ratio", a, b, c, fn },
    );
  },
  check(p, v: number) {
    if (p.kind === "cofunction") {
      const rad = Math.PI / 180;
      return v > 0 && v < 90 && approxEqual(Math.sin(v * rad), Math.cos(p.k * rad));
    }
    // Build the angle from the side lengths and evaluate the trig function directly.
    const A = Math.atan2(p.a, p.b);
    const actual = { sin: Math.sin(A), cos: Math.cos(A), tan: Math.tan(A) }[p.fn as "sin" | "cos" | "tan"];
    return approxEqual(v, actual);
  },
};

const ANGLES = [30, 36, 40, 45, 60, 72, 80, 90, 100, 120, 135, 144, 150, 180, 210, 240, 270, 300];

export const circleArcSector: Generator = {
  id: "circle-arc-sector",
  title: "Arc length and sector area",
  skill: "circles",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const r = randInt(rng, 2, 12);
    const theta = pick(rng, ANGLES);
    const frac = theta / 360;
    if (difficulty === 3) {
      const k = frac * r * r;
      return spr(
        `A circle has radius ${m(r)}. A sector of the circle has a central angle of ${m(`${theta}^\\circ`)}. The area of the sector is ${m("k\\pi")}. What is the value of ${m("k")}?`,
        ratText(k),
        [
          `A sector is a fraction of the whole circle: ${m(`\\frac{${theta}}{360} = ${ratTex(frac)}`)}.`,
          ``,
          `$$\\text{Area} = ${ratTex(frac)} \\cdot \\pi (${r})^2 = ${piTex(k)}$$`,
          ``,
          `So ${m(`k = ${ratTex(k)}`)}.`,
        ].join("\n"),
        k,
        { kind: "sector", r, theta },
      );
    }
    const ans = frac * 2 * r;
    const built = buildMcq(
      rng,
      ans,
      [
        { value: frac * r * r, note: "This is the sector's area, not the arc length." },
        { value: frac * r, note: "Used πr instead of the circumference 2πr." },
        { value: 2 * r, note: "This is the full circumference; the arc is only part of it." },
      ],
      (v) => m(piTex(v)),
      (i) => ({ value: ans + i, note: "Arithmetic slip." }),
    );
    return mcq(
      `A circle has radius ${m(r)}. What is the length of an arc of the circle intercepted by a central angle of ${m(`${theta}^\\circ`)}?`,
      built,
      [
        `An arc is the same fraction of the circumference as its central angle is of ${m("360^\\circ")}.`,
        ``,
        `$$\\frac{${theta}}{360} \\cdot 2\\pi(${r}) = ${ratTex(frac)} \\cdot ${2 * r}\\pi = ${piTex(ans)}$$`,
      ].join("\n"),
      { kind: "arc", r, theta },
    );
  },
  check(p, v: number) {
    const rad = (p.theta * Math.PI) / 180;
    // arc = r·θ(radians); area = ½·r²·θ(radians); v is the coefficient of π
    if (p.kind === "arc") return approxEqual(v * Math.PI, p.r * rad);
    return approxEqual(v * Math.PI, 0.5 * p.r * p.r * rad);
  },
};

function circleEqTex(D: number, E: number, F: number): string {
  let s = "x^2 + y^2";
  if (D) s += ` ${D < 0 ? "-" : "+"} ${Math.abs(D)}x`;
  if (E) s += ` ${E < 0 ? "-" : "+"} ${Math.abs(E)}y`;
  if (F) s += ` ${signed(F)}`;
  return `${s} = 0`;
}

export const circleEquation: Generator = {
  id: "circle-equation",
  title: "Center and radius from a circle's equation",
  skill: "circles",
  difficulties: [2, 3],
  generate(rng, difficulty) {
    const h = randNonZero(rng, -6, 6);
    const k = randNonZero(rng, -6, 6);
    const r = randInt(rng, 1, 9);
    const D = -2 * h;
    const E = -2 * k;
    const F = h * h + k * k - r * r;
    const eq = circleEqTex(D, E, F);
    const params = { D, E, F };
    const completing = [
      `Complete the square in ${m("x")} and in ${m("y")}:`,
      ``,
      `$$(x ${signed(-h)})^2 + (y ${signed(-k)})^2 = ${-F} + ${h * h} + ${k * k} = ${r * r}$$`,
      ``,
      `This is a circle with center ${m(`(${h}, ${k})`)} and radius ${m(`\\sqrt{${r * r}} = ${r}`)}.`,
    ].join("\n");
    if (difficulty === 3) {
      return spr(
        `The equation of a circle in the ${m("xy")}-plane is ${m(eq)}. What is the radius of the circle?`,
        String(r),
        completing,
        r,
        { ...params, kind: "radius" },
      );
    }
    type Pt = [number, number];
    const built = buildMcq<Pt>(
      rng,
      [h, k],
      [
        { value: [-h, -k], note: "Sign error: (x − h)² has center coordinate +h." },
        { value: [D, E], note: "Used the linear coefficients directly; the center coordinates are −D/2 and −E/2." },
        { value: [h, -k], note: "Sign error on the y-coordinate." },
      ],
      (v) => m(`(${v[0]}, ${v[1]})`),
      (i) => ({ value: [h + i, k], note: "Arithmetic slip." }),
    );
    return mcq(
      `The equation of a circle in the ${m("xy")}-plane is ${m(eq)}. What are the coordinates of the center of the circle?`,
      built,
      completing,
      { ...params, kind: "center" },
    );
  },
  check(p, v) {
    const f = (x: number, y: number) => x * x + y * y + p.D * x + p.E * y + p.F;
    if (p.kind === "radius") {
      const cx = -p.D / 2;
      const cy = -p.E / 2;
      return v > 0 && approxEqual(f(cx + v, cy), 0) && approxEqual(f(cx, cy - v), 0);
    }
    // The center is the point of symmetry: f(x+t, y) = f(x−t, y) and f(x, y+t) = f(x, y−t).
    const [x, y] = v as [number, number];
    return [1, 2, 5].every((t) => approxEqual(f(x + t, y), f(x - t, y)) && approxEqual(f(x, y + t), f(x, y - t)));
  },
};

export const triangleAngles: Generator = {
  id: "triangle-angles",
  title: "Angle sum of a triangle",
  skill: "lines-angles-triangles",
  difficulties: [1, 2],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      let a: number, b: number, c: number;
      for (;;) {
        a = randInt(rng, 1, 6);
        b = randInt(rng, 1, 7);
        c = randInt(rng, 2, 8);
        if (180 % (a + b + c) === 0 && new Set([a, b, c]).size === 3) break;
      }
      const x = 180 / (a + b + c);
      const coef = (n: number) => (n === 1 ? "" : String(n));
      const built = buildMcq(
        rng,
        x,
        [
          { value: 360 / (a + b + c), note: "Used 360° (the angle sum of a quadrilateral) instead of 180°." },
          { value: c * x, note: `This is the largest angle's measure, ${m(`${c}x`)}, not ${m("x")}.` },
          { value: 90 / (a + b + c), note: "Used 90° instead of 180° for the angle sum." },
        ],
        (v) => m(ratTex(v)),
        (i) => ({ value: x + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `The measures of the three angles of a triangle are ${m(`${coef(a)}x^\\circ`)}, ${m(`${coef(b)}x^\\circ`)}, and ${m(`${coef(c)}x^\\circ`)}. What is the value of ${m("x")}?`,
        built,
        [
          `The angles of a triangle add to ${m("180^\\circ")}:`,
          ``,
          `$$${coef(a)}x + ${coef(b)}x + ${coef(c)}x = 180 \\;\\Rightarrow\\; ${a + b + c}x = 180 \\;\\Rightarrow\\; x = ${x}$$`,
        ].join("\n"),
        { kind: "ratio", a, b, c },
      );
    }
    // (px + q)°, (sx + t)°, u°: find the largest angle
    for (;;) {
      const x = randInt(rng, 5, 25);
      const p = randInt(rng, 2, 5);
      const s = randInt(rng, 1, 4);
      const q = randInt(rng, -10, 20);
      const t = randInt(rng, -10, 20);
      const A1 = p * x + q;
      const A2 = s * x + t;
      const u = 180 - A1 - A2;
      if (A1 <= 0 || A2 <= 0 || u <= 5 || new Set([A1, A2, u]).size < 3) continue;
      const largest = Math.max(A1, A2, u);
      const expr = (c: number, d: number) => `(${c === 1 ? "" : c}x ${signed(d)})^\\circ`.replace(" + 0)", ")").replace(" - 0)", ")");
      return spr(
        `In triangle ${m("PQR")}, the measure of angle ${m("P")} is ${m(expr(p, q))}, the measure of angle ${m("Q")} is ${m(expr(s, t))}, and the measure of angle ${m("R")} is ${m(`${u}^\\circ`)}. What is the measure, in degrees, of the largest angle of the triangle?`,
        String(largest),
        [
          `1. Angle sum: ${m(`(${p}x ${signed(q)}) + (${s}x ${signed(t)}) + ${u} = 180`)}.`,
          `2. Simplify: ${m(`${p + s}x + ${q + t + u} = 180`)}, so ${m(`x = ${x}`)}.`,
          `3. The angles are ${m(`${A1}^\\circ`)}, ${m(`${A2}^\\circ`)}, and ${m(`${u}^\\circ`)}. The largest is ${m(`${largest}^\\circ`)}.`,
          ``,
          `Remember the question asks for an angle, not ${m("x")}.`,
        ].join("\n"),
        largest,
        { kind: "largest", p, q, s, t, u },
      );
    }
  },
  check(pr, v: number) {
    if (pr.kind === "ratio") return approxEqual((pr.a + pr.b + pr.c) * v, 180);
    const x = (180 - pr.u - pr.q - pr.t) / (pr.p + pr.s);
    return v === Math.max(pr.p * x + pr.q, pr.s * x + pr.t, pr.u);
  },
};

export const areaVolume: Generator = {
  id: "area-volume",
  title: "Volume and surface area",
  skill: "area-volume",
  difficulties: [1, 2, 3],
  generate(rng, difficulty) {
    if (difficulty === 1) {
      const r = randInt(rng, 2, 9);
      const h = randInt(rng, 2, 15);
      const ans = r * r * h;
      const built = buildMcq(
        rng,
        ans,
        [
          { value: 2 * r * h, note: "This is the lateral surface area (2πrh), not the volume." },
          { value: r * h, note: "Forgot to square the radius." },
          { value: 4 * r * r * h, note: "Used the diameter in place of the radius." },
        ],
        (v) => m(piTex(v)),
        (i) => ({ value: ans + i * r, note: "Arithmetic slip." }),
      );
      return mcq(
        `A right circular cylinder has a radius of ${m(r)} centimeters and a height of ${m(h)} centimeters. What is the volume, in cubic centimeters, of the cylinder?`,
        built,
        [`$$V = \\pi r^2 h = \\pi (${r})^2 (${h}) = ${ans}\\pi$$`].join("\n"),
        { kind: "cyl", r, h },
      );
    }
    if (difficulty === 2) {
      const s = randInt(rng, 2, 12);
      const S = 6 * s * s;
      const ans = s ** 3;
      const built = buildMcq(
        rng,
        ans,
        [
          { value: S / 6, note: "This is the area of one face, not the volume." },
          { value: s, note: "This is the edge length." },
          { value: (S / 6) * 6 * s, note: "Multiplied the total surface area by the edge length." },
        ],
        (v) => m(v),
        (i) => ({ value: ans + i, note: "Arithmetic slip." }),
      );
      return mcq(
        `The total surface area of a cube is ${m(S)} square inches. What is the volume, in cubic inches, of the cube?`,
        built,
        [
          `A cube has 6 congruent square faces.`,
          ``,
          `1. Area of one face: ${m(`${S} \\div 6 = ${s * s}`)}.`,
          `2. Edge length: ${m(`\\sqrt{${s * s}} = ${s}`)}.`,
          `3. Volume: ${m(`${s}^3 = ${ans}`)}.`,
        ].join("\n"),
        { kind: "cube", S },
      );
    }
    const k = randInt(rng, 2, 5);
    const [l, w, hh] = [randInt(rng, 2, 9), randInt(rng, 2, 9), randInt(rng, 2, 9)];
    return spr(
      `A rectangular box has length ${m(l)}, width ${m(w)}, and height ${m(hh)}. A second box is made by multiplying each dimension of the first box by ${m(k)}. The volume of the second box is how many times the volume of the first box?`,
      String(k ** 3),
      [
        `Scaling every length by ${m(k)} multiplies volume by ${m(`${k}^3`)}, because volume uses three lengths.`,
        ``,
        `$$\\frac{(${k}\\cdot${l})(${k}\\cdot${w})(${k}\\cdot${hh})}{${l}\\cdot${w}\\cdot${hh}} = ${k}^3 = ${k ** 3}$$`,
      ].join("\n"),
      k ** 3,
      { kind: "scale", k, l, w, h: hh },
    );
  },
  check(p, v: number) {
    if (p.kind === "cyl") return approxEqual(v * Math.PI, Math.PI * p.r * p.r * p.h);
    if (p.kind === "cube") {
      const edge = Math.cbrt(v);
      return approxEqual(6 * edge * edge, p.S);
    }
    return approxEqual(v * p.l * p.w * p.h, p.k * p.l * p.k * p.w * p.k * p.h);
  },
};

export const geometryGenerators: Generator[] = [
  pythagorean,
  similarTriangles,
  rightTriangleTrig,
  circleArcSector,
  circleEquation,
  triangleAngles,
  areaVolume,
];
