import { expect } from 'vitest'

/**
 * Format a value for display in error messages.
 * @param value - The value to format.
 * @param indent - The indentation level.
 * @returns The formatted value string.
 */
function formatValue (value, indent = 0) {
  const spaces = '  '.repeat(indent)
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value
      .map((item, index) => {
        if (!(index in value)) return `${spaces}  <empty>`
        return `${spaces}  ${formatValue(item, indent + 1)}`
      })
      .join(',\n')
    return `[\n${items}\n${spaces}]`
  }
  if (typeof value === 'object') {
    if (
      typeof value.asymmetricMatch === 'function' &&
      value.toString !== Object.prototype.toString
    ) {
      return value.toString()
    }
    const keys = Object.keys(value)
    if (keys.length === 0) return '{}'
    const items = keys
      .map(key => `${spaces}  ${key}: ${formatValue(value[key], indent + 1)}`)
      .join(',\n')
    return `{\n${items}\n${spaces}}`
  }
  return String(value)
}

/**
 * Custom matcher that replicates `@std/expect`'s toMatchObject semantics for arrays.
 *
 * Key difference from Vitest's built-in toMatchObject:
 * - For arrays: only checks that each element in `expected` matches the corresponding
 *   element in `received` at the same index. Extra elements in `received` are ignored.
 * - For objects: checks that all keys in `expected` exist in `received` with matching values.
 *   Extra keys in `received` are ignored.
 *
 * This matches the behavior of `@std/expect` from Deno which uses subsetEquality.
 * @param received - The actual value received.
 * @param expected - The expected subset to match.
 * @param [asymmetricMatchers] - Optional asymmetric matchers.
 * @returns Whether the received value matches the expected subset.
 */
function subsetMatch (received, expected, asymmetricMatchers) {
  // Handle asymmetric matchers (like expect.any(Number))
  if (
    expected != null &&
    typeof expected === 'object' &&
    typeof expected.asymmetricMatch === 'function'
  ) {
    return expected.asymmetricMatch(received)
  }

  // Handle null/undefined
  if (expected === null || expected === undefined) {
    return received === expected
  }

  // Handle primitives
  if (typeof expected !== 'object') {
    return Object.is(received, expected)
  }

  // Handle Date objects
  if (expected instanceof Date) {
    return received instanceof Date && received.getTime() === expected.getTime()
  }

  // Handle RegExp objects
  if (expected instanceof RegExp) {
    return (
      received instanceof RegExp &&
      received.source === expected.source &&
      received.flags === expected.flags
    )
  }

  // Handle arrays - this is the key difference from Vitest's toMatchObject
  // We only check elements up to expected.length
  if (Array.isArray(expected)) {
    if (!Array.isArray(received)) {
      return false
    }
    // Check each element in expected matches the corresponding element in received
    for (let i = 0; i < expected.length; i++) {
      // Skip sparse array slots (undefined created by `new Array(n)`)
      if (!(i in expected)) {
        continue
      }
      if (!(i in received)) {
        return false
      }
      if (!subsetMatch(received[i], expected[i], asymmetricMatchers)) {
        return false
      }
    }
    return true
  }

  // Handle plain objects - subset matching
  if (typeof received !== 'object' || received === null) {
    return false
  }

  // Check all keys in expected exist in received with matching values
  for (const key of Object.keys(expected)) {
    if (!(key in received)) {
      return false
    }
    if (!subsetMatch(received[key], expected[key], asymmetricMatchers)) {
      return false
    }
  }

  return true
}

expect.extend({
  /**
   * Custom toMatchObject that replicates `@std/expect` semantics.
   * This overrides Vitest's built-in toMatchObject for array subset matching.
   * @param received - The actual value received.
   * @param expected - The expected subset to match.
   * @returns The matcher result with pass and message.
   */
  toMatchObject (received, expected) {
    const pass = subsetMatch(received, expected)

    return {
      message: () => {
        if (pass) {
          return `expected ${formatValue(received)} not to match object ${formatValue(expected)}`
        }
        return `expected ${formatValue(received)} to match object ${formatValue(expected)}`
      },
      pass,
    }
  },
})
