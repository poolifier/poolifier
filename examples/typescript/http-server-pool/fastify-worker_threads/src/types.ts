import type { ThreadPoolOptions } from 'poolifier'

export interface BodyPayload {
  number?: number
}

export interface WorkerData<T = unknown> {
  body: T
}

export interface WorkerResponse<T = unknown> {
  body: T
}

export interface FastifyPoolifierOptions extends ThreadPoolOptions {
  maxWorkers?: number
  minWorkers?: number
  workerFile: string
}
