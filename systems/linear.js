// Solve A·x = b for a small dense system, by Gaussian elimination with
// partial pivoting. The systems solver's networks are a few nodes each,
// but a network keeps the same links for step after step, so the
// elimination is kept (`factor`) and only b is run through it each step
// (`solveFactored`) — the same operations in the same order as
// eliminating afresh, so the same answer to the last bit.

// Factor A in place: the multipliers below the diagonal, U on and above
// it, and the row swaps in order. Returns null when A is singular (a
// network with nothing to hold its level — solve.js never asks for one,
// and says so if it ever does).
export function factor(A) {
  const n = A.length;
  const piv = new Int32Array(n);
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
    piv[c] = p;
    if (p !== c) [A[p], A[c]] = [A[c], A[p]];
    const pivot = A[c][c];
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c] / pivot;
      A[r][c] = k;
      if (k === 0) continue;
      for (let j = c + 1; j < n; j++) A[r][j] -= k * A[c][j];
    }
  }
  return { A, piv };
}

// x for A·x = b, given A's factors. b is left as it was.
export function solveFactored({ A, piv }, b) {
  const n = b.length;
  const y = Float64Array.from(b);
  for (let c = 0; c < n; c++) {
    const p = piv[c];
    if (p !== c) [y[p], y[c]] = [y[c], y[p]];
  }
  for (let c = 0; c < n; c++) {
    for (let r = c + 1; r < n; r++) {
      const k = A[r][c];
      if (k !== 0) y[r] -= k * y[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = y[r];
    for (let j = r + 1; j < n; j++) s -= A[r][j] * x[j];
    x[r] = s / A[r][r];
  }
  return x;
}

// Both at once, for a system solved only once. A is overwritten.
export function solveLinear(A, b) {
  const f = factor(A);
  return f && solveFactored(f, b);
}
