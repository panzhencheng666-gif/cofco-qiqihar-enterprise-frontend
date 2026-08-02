const javaIntegerMinimum = -2147483648n;
const javaIntegerMaximum = 2147483647n;

// Generated with JDK 21.0.12 by scanning Character.digit(codePoint, 10) == 0.
// Each entry begins one contiguous ten-code-point decimal digit range.
const java21DecimalZeroCodePoints = [
  0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6,
  0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0,
  0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0,
  0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x11066, 0x110f0, 0x11136, 0x111d0,
  0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x11730, 0x118e0, 0x11950, 0x11c50,
  0x11d50, 0x11da0, 0x11f50, 0x16a60, 0x16ac0, 0x16b50, 0x1d7ce, 0x1d7d8, 0x1d7e2,
  0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e950, 0x1fbf0,
] as const;

export function parseJavaInt32(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;

  const codePoints = Array.from(value);
  const sign = codePoints[0] === "-" ? -1n : 1n;
  const firstDigit = codePoints[0] === "+" || codePoints[0] === "-" ? 1 : 0;
  if (firstDigit === codePoints.length) return undefined;

  let magnitude = 0n;
  for (let index = firstDigit; index < codePoints.length; index += 1) {
    const digit = java21DecimalDigit(codePoints[index]!.codePointAt(0)!);
    if (digit === undefined) return undefined;
    magnitude = magnitude * 10n + BigInt(digit);
  }

  const parsed = sign * magnitude;
  return parsed >= javaIntegerMinimum && parsed <= javaIntegerMaximum
    ? Number(parsed)
    : undefined;
}

function java21DecimalDigit(codePoint: number) {
  let low = 0;
  let high = java21DecimalZeroCodePoints.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const zero = java21DecimalZeroCodePoints[middle]!;
    if (zero <= codePoint) {
      candidate = zero;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const digit = codePoint - candidate;
  return candidate >= 0 && digit >= 0 && digit <= 9 ? digit : undefined;
}
