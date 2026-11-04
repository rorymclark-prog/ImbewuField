export interface JsonDetachOptions {
  /** Optional form properties may follow ordinary JSON omission. Array holes
   * and undefined array elements are never converted into invented null rows. */
  readonly allowUndefinedObjectFields?: boolean;
}

/** Descriptor copies do not invoke a caller's getters or JSON hooks. */
export function detachJsonData(value: unknown, options: JsonDetachOptions = {}, ancestors = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
    || typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw Error('Unsafe saved data');
  const prototype = Object.getPrototypeOf(value), array = Array.isArray(value);
  if (!array && prototype !== Object.prototype && prototype !== null) throw Error('Unsafe saved data');
  if (array && Reflect.ownKeys(value).length !== value.length + 1) throw Error('Unsafe saved data');
  ancestors.add(value);
  try {
    const output: Record<string, unknown> | unknown[] = array ? [] : {};
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('Unsafe saved data');
      if (array && !/^(0|[1-9]\d*)$/.test(key)) throw Error('Unsafe saved data');
      if (!array && options.allowUndefinedObjectFields && descriptor.value === undefined) continue;
      Object.defineProperty(output, key, { value: detachJsonData(descriptor.value, options, ancestors), enumerable: true, configurable: true, writable: true });
    }
    if (array && (output as unknown[]).length !== value.length) throw Error('Unsafe saved data');
    return output;
  } finally { ancestors.delete(value); }
}

function decimalIdentity(literal: string): string {
  const parts = /^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(literal);
  if (!parts) throw Error('Invalid JSON number');
  let digits = (parts[2] + (parts[3] ?? '')).replace(/^0+/, '');
  if (!digits) return '0';
  const end = digits.length; digits = digits.replace(/0+$/, '');
  const exponent = BigInt(parts[4] ?? '0') - BigInt((parts[3] ?? '').length) + BigInt(end - digits.length);
  return `${parts[1]}${digits}e${exponent}`;
}

/** JSON.parse owns grammar. This token pass rejects information it would lose:
 * duplicate object members, nonfinite/rounded numbers and negative-zero tokens. */
export function rawJsonIsLossless(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    JSON.parse(raw);
    const stack: Array<{ object: boolean; key: boolean; keys: Set<string> }> = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i], top = stack.at(-1);
      if (c === '{' || c === '[') stack.push({ object: c === '{', key: c === '{', keys: new Set() });
      else if (c === '}' || c === ']') stack.pop();
      else if (c === ',') { if (top?.object) top.key = true; }
      else if (c === ':') { if (top?.object) top.key = false; }
      else if (c === '"') {
        const start = i++;
        while (i < raw.length && raw[i] !== '"') { if (raw[i] === '\\') i++; i++; }
        if (top?.object && top.key) {
          const key: string = JSON.parse(raw.slice(start, i + 1));
          if (top.keys.has(key)) return false;
          top.keys.add(key);
        }
      } else if (c === '-' || c >= '0' && c <= '9') {
        const start = i;
        while (i + 1 < raw.length && /[0-9eE+.-]/.test(raw[i + 1])) i++;
        const literal = raw.slice(start, i + 1), number = Number(literal);
        if (!Number.isFinite(number) || Object.is(number, -0)
          || decimalIdentity(literal) !== decimalIdentity(JSON.stringify(number))) return false;
      }
    }
    return true;
  } catch { return false; }
}
