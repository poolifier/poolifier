import { ThreadWorker } from 'poolifier'

/**
 * First worker function example.
 * @param data - The input data containing text.
 * @returns The processed result with modified text.
 */
function fn0 (data) {
  console.info('Executing fn0')
  return { data: `fn0 input text was '${data.text}'` }
}

/**
 * Second worker function example.
 * @param data - The input data containing text.
 * @returns The processed result with modified text.
 */
function fn1 (data) {
  console.info('Executing fn1')
  return { data: `fn1 input text was '${data.text}'` }
}

export default new ThreadWorker({ fn0, fn1 })
