import { ClusterWorker } from 'poolifier'
import { type RawData, WebSocketServer } from 'ws'
import {
  type DataPayload,
  type MessagePayload,
  MessageType,
  type WorkerData,
  type WorkerResponse
} from './types.js'

class WebSocketServerWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  private static wss: WebSocketServer

  private static readonly factorial = (n: number): number => {
    if (n === 0) {
      return 1
    }
    return WebSocketServerWorker.factorial(n - 1) * n
  }

  private static readonly startWebSocketServer = (
    workerData?: WorkerData
  ): WorkerResponse => {
    const { port } = workerData!

    WebSocketServerWorker.wss = new WebSocketServer({ port }, () => {
      console.info(
        `⚡️[ws server]: WebSocket server is started in cluster worker at ws://localhost:${port}/`
      )
    })

    WebSocketServerWorker.wss.on('connection', ws => {
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
                data: {
                  number: WebSocketServerWorker.factorial(data.number!)
                }
              })
            )
            break
        }
      })
    })
    return {
      status: true,
      port: WebSocketServerWorker.wss.options.port
    }
  }

  public constructor () {
    super(WebSocketServerWorker.startWebSocketServer, {
      killHandler: () => {
        WebSocketServerWorker.wss.close()
      }
    })
  }
}

export const webSocketServerWorker = new WebSocketServerWorker()
