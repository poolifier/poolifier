import { expect } from 'expect'
import {
  CircularArray,
  DEFAULT_CIRCULAR_ARRAY_SIZE
} from '../lib/circular-array.js'

describe('Circular array test suite', () => {
  it('Verify that circular array can be instantiated', () => {
    const circularArray = new CircularArray()
    expect(circularArray).toBeInstanceOf(CircularArray)
  })

  it('Verify circular array default size at instance creation', () => {
    const circularArray = new CircularArray()
    expect(circularArray.size).toBe(DEFAULT_CIRCULAR_ARRAY_SIZE)
  })

  it('Verify that circular array size can be set at instance creation', () => {
    const circularArray = new CircularArray(1000)
    expect(circularArray.size).toBe(1000)
  })

  it('Verify that circular array size and items can be set at instance creation', () => {
    let circularArray = new CircularArray(1000, 1, 2, 3, 4, 5)
    expect(circularArray.size).toBe(1000)
    expect(circularArray.length).toBe(5)
    circularArray = new CircularArray(4, 1, 2, 3, 4, 5)
    expect(circularArray.size).toBe(4)
    expect(circularArray.length).toBe(4)
  })

  it('Verify that circular array size is valid at instance creation', () => {
    expect(() => new CircularArray(0.25)).toThrowError(
      new TypeError('Invalid circular array size: 0.25 is not a safe integer')
    )
    expect(() => new CircularArray(-1)).toThrowError(
      new RangeError('Invalid circular array size: -1 < 0')
    )
    expect(() => new CircularArray(Number.MAX_SAFE_INTEGER + 1)).toThrowError(
      new TypeError(
        `Invalid circular array size: ${
          Number.MAX_SAFE_INTEGER + 1
        } is not a safe integer`
      )
    )
  })

  it('Verify that circular array empty works as intended', () => {
    const circularArray = new CircularArray()
    expect(circularArray.empty()).toBe(true)
  })

  it('Verify that circular array full works as intended', () => {
    const circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    expect(circularArray.full()).toBe(true)
  })

  it('Verify that circular array push works as intended', () => {
    let circularArray = new CircularArray(4)
    let arrayLength = circularArray.push(1, 2, 3, 4, 5)
    expect(arrayLength).toBe(circularArray.size)
    expect(circularArray.length).toBe(circularArray.size)
    expect(circularArray).toStrictEqual(new CircularArray(4, 2, 3, 4, 5))
    arrayLength = circularArray.push(6, 7)
    expect(arrayLength).toBe(circularArray.size)
    expect(circularArray.length).toBe(circularArray.size)
    expect(circularArray).toStrictEqual(new CircularArray(4, 4, 5, 6, 7))
    circularArray = new CircularArray(100)
    arrayLength = circularArray.push(1, 2, 3, 4, 5)
    expect(arrayLength).toBe(5)
    expect(circularArray.size).toBe(100)
    expect(circularArray.length).toBe(5)
    expect(circularArray).toStrictEqual(new CircularArray(100, 1, 2, 3, 4, 5))
  })

  it('Verify that circular array splice works as intended', () => {
    let circularArray = new CircularArray(1000, 1, 2, 3, 4, 5)
    let deletedItems = circularArray.splice(2)
    expect(deletedItems).toStrictEqual(new CircularArray(3, 3, 4, 5))
    expect(circularArray.length).toBe(2)
    expect(circularArray).toStrictEqual(new CircularArray(1000, 1, 2))
    circularArray = new CircularArray(1000, 1, 2, 3, 4, 5)
    deletedItems = circularArray.splice(2, 1)
    expect(deletedItems).toStrictEqual(new CircularArray(1, 3))
    expect(circularArray.length).toBe(4)
    expect(circularArray).toStrictEqual(new CircularArray(1000, 1, 2, 4, 5))
    circularArray = new CircularArray(4, 1, 2, 3, 4)
    deletedItems = circularArray.splice(2, 1, 5, 6)
    expect(deletedItems).toStrictEqual(new CircularArray(2, 3, 1))
    expect(circularArray.length).toBe(4)
    expect(circularArray).toStrictEqual(new CircularArray(4, 2, 5, 6, 4))
  })

  it('Verify that circular array concat works as intended', () => {
    let circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    circularArray = circularArray.concat(6, 7)
    expect(circularArray.length).toBe(5)
    expect(circularArray).toStrictEqual(new CircularArray(5, 3, 4, 5, 6, 7))
    circularArray = new CircularArray(1)
    circularArray = circularArray.concat(6, 7)
    expect(circularArray.length).toBe(1)
    expect(circularArray).toStrictEqual(new CircularArray(1, 7))
  })

  it('Verify that circular array unshift works as intended', () => {
    let circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    let arrayLength = circularArray.unshift(6, 7)
    expect(arrayLength).toBe(5)
    expect(circularArray.length).toBe(5)
    expect(circularArray).toStrictEqual(new CircularArray(5, 6, 7, 1, 2, 3))
    circularArray = new CircularArray(1)
    arrayLength = circularArray.unshift(6, 7)
    expect(arrayLength).toBe(1)
    expect(circularArray.length).toBe(1)
    expect(circularArray).toStrictEqual(new CircularArray(1, 6))
  })

  it('Verify that circular array resize works as intended', () => {
    expect(() => new CircularArray().resize(0.25)).toThrowError(
      new TypeError('Invalid circular array size: 0.25 is not a safe integer')
    )
    expect(() => new CircularArray().resize(-1)).toThrowError(
      new RangeError('Invalid circular array size: -1 < 0')
    )
    expect(() =>
      new CircularArray().resize(Number.MAX_SAFE_INTEGER + 1)
    ).toThrowError(
      new TypeError(
        `Invalid circular array size: ${
          Number.MAX_SAFE_INTEGER + 1
        } is not a safe integer`
      )
    )
    let circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    circularArray.resize(0)
    expect(circularArray.size).toBe(0)
    expect(circularArray).toStrictEqual(new CircularArray(0))
    circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    circularArray.resize(1)
    expect(circularArray.size).toBe(1)
    expect(circularArray).toStrictEqual(new CircularArray(1, 1))
    circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    circularArray.resize(3)
    expect(circularArray.size).toBe(3)
    expect(circularArray).toStrictEqual(new CircularArray(3, 1, 2, 3))
    circularArray = new CircularArray(5, 1, 2, 3, 4, 5)
    circularArray.resize(8)
    expect(circularArray.size).toBe(8)
    expect(circularArray).toStrictEqual(new CircularArray(8, 1, 2, 3, 4, 5))
  })
})
