import type { Worker } from 'worker_threads'
import type { PoolOptions } from 'poolifier'

export interface BodyPayload {
  number?: number
}

export interface WorkerData<T = unknown> {
  body: T
}

export interface WorkerResponse<T = unknown> {
  body: T
}

export interface FastifyPoolifierOptions extends PoolOptions<Worker> {
  workerFile: string
  minWorkers?: number
  maxWorkers?: number
}
