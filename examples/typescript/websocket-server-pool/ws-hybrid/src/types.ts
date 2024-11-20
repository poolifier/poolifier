import type { ThreadPoolOptions } from 'poolifier'

export enum MessageType {
  echo = 'echo',
  factorial = 'factorial',
}

export interface ClusterWorkerData extends ThreadPoolOptions {
  maxWorkers?: number
  minWorkers?: number
  port: number
  workerFile: string
}

export interface ClusterWorkerResponse {
  port?: number
  status: boolean
}

export interface DataPayload {
  number?: number
}

export interface MessagePayload<T = unknown> {
  data: T
  type: MessageType
}

export interface ThreadWorkerData<T = unknown> {
  data: T
}

export interface ThreadWorkerResponse<T = unknown> {
  data: T
}
