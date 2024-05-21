import { expect } from 'expect'

import { CircularBuffer, defaultBufferSize } from '../lib/circular-buffer.cjs'

describe('Circular buffer test suite', t => {
  it('Verify that circular buffer can be instantiated', () => {
    const circularBuffer = new CircularBuffer()
    expect(circularBuffer).toBeInstanceOf(CircularBuffer)
    expect(circularBuffer.readIdx).toBe(0)
    expect(circularBuffer.writeIdx).toBe(0)
    expect(circularBuffer.maxArrayIdx).toBe(defaultBufferSize - 1)
    expect(circularBuffer.items).toBeInstanceOf(Array)
    expect(circularBuffer.items.length).toBe(defaultBufferSize)
  })

  it('Verify that circular buffer size can be set at instance creation', () => {
    const circularBuffer = new CircularBuffer(1000)
    expect(circularBuffer.maxArrayIdx).toBe(999)
    expect(circularBuffer.items).toBeInstanceOf(Array)
    expect(circularBuffer.items.length).toBe(1000)
  })

  it('Verify that circular buffer size is valid at instance creation', () => {
    expect(() => new CircularBuffer(0.25)).toThrow(
      new TypeError('Invalid circular buffer size: 0.25 is not an integer')
    )
    expect(() => new CircularBuffer(-1)).toThrow(
      new RangeError('Invalid circular buffer size: -1 < 0')
    )
    expect(() => new CircularBuffer(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      new TypeError(
        `Invalid circular buffer size: ${
          Number.MAX_SAFE_INTEGER + 1
        } is not an integer`
      )
    )
  })

  it('Verify that circular buffer put() works as intended', () => {
    const circularBuffer = new CircularBuffer(4)
    circularBuffer.put(1)
    expect(circularBuffer.items).toMatchObject([1])
    expect(circularBuffer.writeIdx).toBe(1)
    circularBuffer.put(2)
    expect(circularBuffer.items).toMatchObject([1, 2])
    expect(circularBuffer.writeIdx).toBe(2)
    circularBuffer.put(3)
    expect(circularBuffer.items).toMatchObject([1, 2, 3])
    expect(circularBuffer.writeIdx).toBe(3)
    circularBuffer.put(4)
    expect(circularBuffer.items).toMatchObject([1, 2, 3, 4])
    expect(circularBuffer.writeIdx).toBe(0)
    circularBuffer.put(5)
    expect(circularBuffer.items).toMatchObject([5, 2, 3, 4])
    expect(circularBuffer.writeIdx).toBe(1)
    circularBuffer.put(6)
    expect(circularBuffer.items).toMatchObject([5, 6, 3, 4])
    expect(circularBuffer.writeIdx).toBe(2)
  })
})
