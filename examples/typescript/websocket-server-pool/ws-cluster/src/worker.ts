import { ClusterWorker } from 'poolifier'
import { type RawData, WebSocketServer } from 'ws'
import {
  type DataPayload,
  type MessagePayload,
  MessageType,
  type WorkerData,
  type WorkerResponse
} from './types.js'

const factorial: (n: number) => number = n => {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

const startWebSocketServer = (workerData?: WorkerData): WorkerResponse => {
  try {
    const wss = new WebSocketServer({ port: workerData?.port }, () => {
      console.info(
        `⚡️[ws server]: WebSocket server is started at ws://localhost:${
          workerData?.port as number
        }/`
      )
    })

    wss.on('connection', ws => {
      ws.on('error', console.error)
      ws.on('message', (message: RawData) => {
        const { type, data } = JSON.parse(
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          message.toString()
        ) as MessagePayload<DataPayload>
        switch (type) {
          case MessageType.echo:
            ws.send(
              JSON.stringify({
                type: MessageType.echo,
                data
              })
            )
            break
          case MessageType.factorial:
            ws.send(
              JSON.stringify({
                type: MessageType.factorial,
                data: { number: factorial(data.number as number) }
              })
            )
            break
        }
      })
    })
    return {
      status: true,
      port: wss.options.port
    }
  } catch (err) {
    return {
      status: false,
      error: err as Error
    }
  }
}

class WebSocketServerWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  public constructor () {
    super(startWebSocketServer)
  }
}

export const webSocketServerWorker = new WebSocketServerWorker()
