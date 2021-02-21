const expect = require('expect')
const { WorkerChoiceStrategies } = require('../../lib/index')

describe('Selection strategies test suite', () => {
  it('Verify ', () => {
    expect(WorkerChoiceStrategies.ROUND_ROBIN).toBe('ROUND_ROBIN')
    expect(WorkerChoiceStrategies.LESS_RECENTLY_USED).toBe('LESS_RECENTLY_USED')
  })
})
