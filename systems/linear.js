// Solve A·x = b for a small dense system, by Gaussian elimination with
// partial pivoting. The systems solver's networks are a few nodes each,
// so nothing cleverer is needed. A and b are overwritten. Returns x, or
// null when the system is singular (a network with nothing to hold its
// level — solve.js never asks for one, and says so if it ever does).
export function solveLinear(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    let best = Math.abs(A[c][c]);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(A[r][c]);
      if (v > best) {
        best = v;
        p = r;
      }
    }
    if (!(best > 1e-300)) return null;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      [b[p], b[c]] = [b[c], b[p]];
    }
    const pivot = A[c][c];
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c] / pivot;
      if (k === 0) continue;
      for (let j = c; j < n; j++) A[r][j] -= k * A[c][j];
      b[r] -= k * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j];
    x[r] = s / A[r][r];
  }
  return x;
}
