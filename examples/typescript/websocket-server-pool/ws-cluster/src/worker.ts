import { ClusterWorker } from 'poolifier'
import { type RawData, WebSocketServer } from 'ws'

import {
  type DataPayload,
  type MessagePayload,
  MessageType,
  type WorkerData,
  type WorkerResponse,
} from './types.js'

class WebSocketServerWorker extends ClusterWorker<WorkerData, WorkerResponse> {
  private static wss: WebSocketServer

  private static readonly factorial = (n: number | bigint): bigint => {
    if (n === 0 || n === 1) {
      return 1n
    } else {
      n = BigInt(n)
      let factorial = 1n
      for (let i = 1n; i <= n; i++) {
        factorial *= i
      }
      return factorial
    }
  }

  private static readonly startWebSocketServer = (
    workerData?: WorkerData
  ): WorkerResponse => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { port } = workerData!

    WebSocketServerWorker.wss = new WebSocketServer({ port }, () => {
      console.info(
        `⚡️[ws server]: WebSocket server is started in cluster worker at ws://localhost:${port.toString()}/`
      )
    })

    WebSocketServerWorker.wss.on('connection', ws => {
      ws.on('error', console.error)
      ws.on('message', (message: RawData) => {
        const { type, data } = JSON.parse(

          message.toString()
        ) as MessagePayload<DataPayload>
        switch (type) {
          case MessageType.echo:
            ws.send(
              JSON.stringify({
                type: MessageType.echo,
                data,
              })
            )
            break
          case MessageType.factorial:
            ws.send(
              JSON.stringify(
                {
                  type: MessageType.factorial,
                  data: {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    number: WebSocketServerWorker.factorial(data.number!),
                  },
                },
                (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)
              )
            )
            break
        }
      })
    })
    return {
      status: true,
      port: WebSocketServerWorker.wss.options.port,
    }
  }

  public constructor () {
    super(WebSocketServerWorker.startWebSocketServer, {
      killHandler: () => {
        WebSocketServerWorker.wss.close()
      },
    })
  }
}

export const webSocketServerWorker = new WebSocketServerWorker()
