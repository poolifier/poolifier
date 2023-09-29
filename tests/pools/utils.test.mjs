import { expect } from 'expect'
import {
  CircularArray,
  DEFAULT_CIRCULAR_ARRAY_SIZE
} from '../../lib/circular-array.js'
import { updateMeasurementStatistics } from '../../lib/pools/utils.js'

describe('Pool utils test suite', () => {
  it('Verify updateMeasurementStatistics() behavior', () => {
    const measurementStatistics = {
      history: new CircularArray()
    }
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.01
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.01,
      maximum: 0.01,
      minimum: 0.01,
      history: new CircularArray()
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.02
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.03,
      maximum: 0.02,
      minimum: 0.01,
      history: new CircularArray()
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.001
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.031,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.001,
      history: new CircularArray(DEFAULT_CIRCULAR_ARRAY_SIZE, 0.001)
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.003
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.034,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.002,
      history: new CircularArray(DEFAULT_CIRCULAR_ARRAY_SIZE, 0.001, 0.003)
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: true },
      0.006
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.04,
      maximum: 0.02,
      minimum: 0.001,
      median: 0.003,
      history: new CircularArray(
        DEFAULT_CIRCULAR_ARRAY_SIZE,
        0.001,
        0.003,
        0.006
      )
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.01
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.05,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.005,
      history: new CircularArray(
        DEFAULT_CIRCULAR_ARRAY_SIZE,
        0.001,
        0.003,
        0.006,
        0.01
      )
    })
  })
})
