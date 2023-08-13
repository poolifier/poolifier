import type { ThreadPoolOptions } from 'poolifier'

export interface ClusterWorkerData extends FastifyPoolifierOptions {
  port: number
}

export interface ClusterWorkerResponse {
  status: boolean
  port?: number
}

export interface BodyPayload {
  number?: number
}

export interface ThreadWorkerData<T = unknown> {
  body: T
}

export interface ThreadWorkerResponse<T = unknown> {
  body: T
}

export interface FastifyPoolifierOptions extends ThreadPoolOptions {
  workerFile: string
  minWorkers?: number
  maxWorkers?: number
}
