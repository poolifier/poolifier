const expect = require('expect')
const { generateID } = require('../lib/util')

describe('Utility Tests ', () => {
  it('Generate an id', () => {
    const res = generateID()
    expect(res).toBeTruthy()
    expect(typeof res).toBe('string')
  })
})
