import type { Worker } from 'worker_threads'
import type { PoolOptions } from 'poolifier'

export interface ClusterWorkerData extends FastifyPoolifierOptions {
  port: number
}

export interface ClusterWorkerResponse {
  status: boolean
  port?: number
}

export interface DataPayload {
  number?: number
}

export interface ThreadWorkerData<T = unknown> {
  data: T
}

export interface ThreadWorkerResponse<T = unknown> {
  data: T
}

export interface FastifyPoolifierOptions extends PoolOptions<Worker> {
  workerFile: string
  minWorkers?: number
  maxWorkers?: number
}
