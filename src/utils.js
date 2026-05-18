/**
 * @import { GanCubeMove } from "./types"
 */

/**
 * Return current host clock timestamp with millisecond precision
 * Use monotonic clock when available
 * @returns {number} Current host clock timestamp in milliseconds
 */
const now =
  typeof window != "undefined" && typeof window.performance?.now == "function"
    ? () => Math.floor(window.performance.now())
    : () => Date.now();

/**
 *
 * @param {Array<number | null>} X
 * @param {Array<number | null>} Y
 * @returns {[number, number]}
 */
function linregress(X, Y) {
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let n = 0;
  for (let i = 0; i < X.length; i++) {
    const x = X[i];
    const y = Y[i];
    if (x == null || y == null) {
      continue;
    }
    n++;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }
  const varX = n * sumXX - sumX * sumX;
  const covXY = n * sumXY - sumX * sumY;
  const slope = varX < 1e-3 ? 1 : covXY / varX;
  const intercept = n < 1 ? 0 : sumY / n - (slope * sumX) / n;
  return [slope, intercept];
}

/**
 * Use linear regression to fit timestamps reported by cube hardware with host device timestamps
 * @param {Array<GanCubeMove>} cubeMoves List representing window of cube moves to operate on
 * @returns {Array<GanCubeMove>} New copy of move list with fitted cubeTimestamp values
 */
function cubeTimestampLinearFit(cubeMoves) {
  /** @type {Array<GanCubeMove>} */
  const res = [];
  // Calculate and fix timestamp values for missed and recovered cube moves.
  if (cubeMoves.length >= 2) {
    // 1st pass - tail-to-head, align missed move cube timestamps to next move -50ms
    for (let i = cubeMoves.length - 1; i > 0; i--) {
      if (
        cubeMoves[i].cubeTimestamp != null &&
        cubeMoves[i - 1].cubeTimestamp == null
      ) {
        cubeMoves[i - 1].cubeTimestamp = (cubeMoves[i].cubeTimestamp ?? 0) - 50;
      }
    }
    // 2nd pass - head-to-tail, align missed move cube timestamp to prev move +50ms
    for (let i = 0; i < cubeMoves.length - 1; i++) {
      if (
        cubeMoves[i].cubeTimestamp != null &&
        cubeMoves[i + 1].cubeTimestamp == null
      ) {
        cubeMoves[i + 1].cubeTimestamp = (cubeMoves[i].cubeTimestamp ?? 0) + 50;
      }
    }
  }
  // Apply linear regression to the cube timestamps
  if (cubeMoves.length > 0) {
    const [slope, intercept] = linregress(
      cubeMoves.map((m) => m.cubeTimestamp),
      cubeMoves.map((m) => m.localTimestamp),
    );
    const first = Math.round(
      slope * (cubeMoves[0].cubeTimestamp ?? 0) + intercept,
    );
    cubeMoves.forEach((m) => {
      res.push({
        face: m.face,
        direction: m.direction,
        move: m.move,
        localTimestamp: m.localTimestamp,
        cubeTimestamp:
          Math.round(slope * (m.cubeTimestamp ?? 0) + intercept) - first,
      });
    });
  }
  return res;
}

/**
 * Calculate time skew degree in percent between cube hardware and host device
 * @param {Array<GanCubeMove>} cubeMoves List representing window of cube moves to operate on
 * @returns {number} Time skew value in percent
 */
function cubeTimestampCalcSkew(cubeMoves) {
  if (!cubeMoves.length) return 0;
  const [slope] = linregress(
    cubeMoves.map((m) => m.localTimestamp),
    cubeMoves.map((m) => m.cubeTimestamp),
  );
  return Math.round((slope - 1) * 100000) / 1000;
}

const CORNER_FACELET_MAP = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
];

const EDGE_FACELET_MAP = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
];

/**
 *
 * Convert Corner/Edge Permutation/Orientation cube state to the Kociemba facelets representation string
 *
 * Example - solved state:
 *   cp = [0, 1, 2, 3, 4, 5, 6, 7]
 *   co = [0, 0, 0, 0, 0, 0, 0, 0]
 *   ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
 *   eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
 *   facelets = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
 * Example - state after F R moves made:
 *   cp = [0, 5, 2, 1, 7, 4, 6, 3]
 *   co = [1, 2, 0, 2, 1, 1, 0, 2]
 *   ep = [1, 9, 2, 3, 11, 8, 6, 7, 4, 5, 10, 0]
 *   eo = [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]
 *   facelets = "UUFUUFLLFUUURRRRRRFFRFFDFFDRRBDDBDDBLLDLLDLLDLBBUBBUBB"
 *
 * @param {Array<number>} cp Corner Permutation
 * @param {Array<number>} co Corner Orientation
 * @param {Array<number>} ep Egde Permutation
 * @param {Array<number>} eo Edge Orientation
 * @returns {string} Cube state in the Kociemba facelets representation string
 *
 */
function toKociembaFacelets(cp, co, ep, eo) {
  const faces = "URFDLB";
  /** @type {Array<string>} */
  const facelets = [];
  for (let i = 0; i < 54; i++) {
    facelets[i] = faces[~~(i / 9)];
  }
  for (let i = 0; i < 8; i++) {
    for (let p = 0; p < 3; p++) {
      facelets[CORNER_FACELET_MAP[i][(p + co[i]) % 3]] =
        faces[~~(CORNER_FACELET_MAP[cp[i]][p] / 9)];
    }
  }
  for (let i = 0; i < 12; i++) {
    for (let p = 0; p < 2; p++) {
      facelets[EDGE_FACELET_MAP[i][(p + eo[i]) % 2]] =
        faces[~~(EDGE_FACELET_MAP[ep[i]][p] / 9)];
    }
  }
  return facelets.join("");
}

export {
  now,
  cubeTimestampLinearFit,
  cubeTimestampCalcSkew,
  toKociembaFacelets,
};
