import type { ThreadPoolOptions } from 'poolifier'

export interface ClusterWorkerData extends FastifyPoolifierOptions {
  port: number
}

export interface ClusterWorkerResponse {
  port?: number
  status: boolean
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

export interface FastifyPoolifierOptions extends ThreadPoolOptions {
  maxWorkers?: number
  minWorkers?: number
  workerFile: string
}
