const expect = require('expect')
const { generateID, randomWorker } = require('../lib/util')

describe('Utility Tests ', () => {
  it('Generate an id', () => {
    const res = generateID()
    expect(res).toBeTruthy()
    expect(typeof res).toBe('string')
  })

  it('Choose a random worker', () => {
    const input = new Map()
    input.set(1, 1)
    input.set(2, 2)
    input.set(3, 3)
    const worker = randomWorker(input)
    expect(worker).toBeTruthy()
    expect(Array.from(input.keys()).includes(worker)).toBeTruthy()
  })
})
