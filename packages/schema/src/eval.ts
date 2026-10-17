import type { EaseT, NumProp } from "./schema";

const bez = (s: number, a: number, b: number) =>
  3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return (u: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
      const s = (lo + hi) / 2;
      bez(s, x1, x2) < u ? (lo = s) : (hi = s);
    }
    return bez((lo + hi) / 2, y1, y2);
  };
}

export function ease(e: EaseT, u: number): number {
  if (typeof e === "object") return cubicBezier(...e.bezier)(u);
  switch (e) {
    case "linear": return u;
    case "easeIn": return u * u;
    case "easeOut": return 1 - (1 - u) * (1 - u);
    case "easeInOut": return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  }
}

/**
 * Evaluate an animatable number at CLIP-LOCAL time `t` (microseconds).
 * The preview player and the export renderer MUST both call this function.
 */
export function evalProp(prop: NumProp, t: number): number {
  if ("value" in prop) return prop.value;
  const k = prop.keys;
  const first = k[0]!, last = k[k.length - 1]!;
  if (t <= first.t) return first.v;
  if (t >= last.t) return last.v;
  const i = k.findIndex((x) => x.t > t) - 1;
  const a = k[i]!, b = k[i + 1]!;
  const u = (t - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * ease(b.ease, u);
}
