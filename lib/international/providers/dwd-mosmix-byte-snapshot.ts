const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset')!.get!;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const ordinaryBufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const setBytes = Uint8Array.prototype.set;

/** A DWD stream chunk and a complete KML need the same actual-byte authority:
 * an own byteLength getter must not hide an oversized view before it is copied.
 * Callers supply their engineering budget and decide whether empty data is useful. */
export function snapshotDwdMosmixBytes(input: unknown, maxBytes: number): Uint8Array<ArrayBuffer> | 'invalid-byte-input' | 'software-bound' {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) return 'software-bound';
  try {
    if (!ArrayBuffer.isView(input) || typedArrayTag.call(input) !== 'Uint8Array') return 'invalid-byte-input';
    const length = typedArrayByteLength.call(input) as number;
    if (length > maxBytes) return 'software-bound';
    const buffer = typedArrayBuffer.call(input) as ArrayBuffer;
    // Shared bytes could change during the copy. Intrinsic ArrayBuffer branding
    // rejects them without reading an input property or invoking its constructor.
    ordinaryBufferLength.call(buffer);
    const offset = typedArrayByteOffset.call(input) as number;
    const view = new Uint8Array(buffer, offset, length);
    const detached = new Uint8Array(length);
    setBytes.call(detached, view);
    return detached;
  } catch { return 'invalid-byte-input'; }
}
