export interface WorkerData {
  port: number
}

export interface WorkerResponse {
  status: boolean
  port?: number
  error?: Error
}
