/** All timeline time is integer microseconds. Snap to frames only at render time. */
export const US_PER_SEC = 1_000_000;
export const secToUs = (s: number): number => Math.round(s * US_PER_SEC);
export const usToSec = (us: number): number => us / US_PER_SEC;
export const snapToFrame = (us: number, fps: number): number =>
  Math.round((Math.round((us / US_PER_SEC) * fps) / fps) * US_PER_SEC);
