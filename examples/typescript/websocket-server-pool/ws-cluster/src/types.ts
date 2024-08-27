export enum MessageType {
  echo = 'echo',
  factorial = 'factorial',
}

export interface MessagePayload<T = unknown> {
  data: T
  type: MessageType
}

export interface DataPayload {
  number?: number
}

export interface WorkerData {
  port: number
}

export interface WorkerResponse {
  port?: number
  status: boolean
}
