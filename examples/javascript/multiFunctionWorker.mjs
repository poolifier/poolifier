import { ThreadWorker } from 'poolifier'

/**
 *
 * @param data
 * @returns
 */
function fn0 (data) {
  console.info('Executing fn0')
  return { data: `fn0 input text was '${data.text}'` }
}

/**
 *
 * @param data
 * @returns
 */
function fn1 (data) {
  console.info('Executing fn1')
  return { data: `fn1 input text was '${data.text}'` }
}

export default new ThreadWorker({ fn0, fn1 })
