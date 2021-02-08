/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import { Pool, PoolOptions } from './pool'

export type FixedThreadPoolOptions = PoolOptions

/**
 * A thread pool with a static number of threads, is possible to execute tasks in sync or async mode as you prefer.
 *
 * This pool will select the worker thread in a round robin fashion.
 *
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class FixedThreadPool<Data = any, Response = any> extends Pool<
Data,
Response
> {}
