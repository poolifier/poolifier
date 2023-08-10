import { type URL } from 'node:url'
import {
  type RequestInfo as NodeFetchRequestInfo,
  type RequestInit as NodeFetchRequestInit
} from 'node-fetch'

export interface WorkerData {
  url: URL | RequestInfo | NodeFetchRequestInfo
  init?: RequestInit | NodeFetchRequestInit
}

export interface WorkerResponse {
  text: string
}
