// Freeze an object and everything inside it, so nothing downstream can
// change it at runtime (ES modules are strict: a write throws). Recurses
// even into objects already frozen on top — a shallow freeze leaves the
// inside writable. Data only: no cycles.
export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
