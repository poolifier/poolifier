import type { URL } from 'node:url'
import {
  type RequestInfo as NodeFetchRequestInfo,
  type RequestInit as NodeFetchRequestInit
} from 'node-fetch'
import type { AxiosRequestConfig } from 'axios'

export interface WorkerData {
  input: URL | RequestInfo | NodeFetchRequestInfo
  init?: RequestInit | NodeFetchRequestInit
  axiosRequestConfig?: AxiosRequestConfig
}

export interface WorkerResponse {
  text: string
}
