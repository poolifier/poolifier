export enum MessageType {
  echo = 'echo',
  factorial = 'factorial'
}

export interface MessagePayload<T = unknown> {
  type: MessageType
  data: T
}

export interface DataPayload {
  number?: number
}

export interface ClusterWorkerData {
  port: number
}

export interface ClusterWorkerResponse {
  status: boolean
  port?: number
}

export interface ThreadWorkerData<T = unknown> {
  data: T
}

export interface ThreadWorkerResponse<T = unknown> {
  data: T
}
