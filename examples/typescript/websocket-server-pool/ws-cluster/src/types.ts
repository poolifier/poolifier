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

export interface WorkerData {
  port: number
}

export interface WorkerResponse {
  status: boolean
  port?: number
  error?: Error
}
