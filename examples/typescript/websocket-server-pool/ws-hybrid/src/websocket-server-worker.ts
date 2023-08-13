import { ClusterWorker } from 'poolifier'
import { type RawData, WebSocketServer } from 'ws'
import {
  type ClusterWorkerData,
  type ClusterWorkerResponse,
  type DataPayload,
  type MessagePayload,
  MessageType
} from './types.js'
import { requestHandlerPool } from './request-handler-pool.js'

const emptyFunction = (): void => {
  /** Intentional */
}

const startWebSocketServer = (
  workerData?: ClusterWorkerData
): ClusterWorkerResponse => {
  const { port } = workerData as ClusterWorkerData
  const wss = new WebSocketServer({ port }, () => {
    console.info(
      `⚡️[ws server]: WebSocket server is started on cluster worker at ws://localhost:${port}/`
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
          requestHandlerPool
            .execute({ data }, 'echo')
            .then(response => {
              ws.send(
                JSON.stringify({
                  type: MessageType.echo,
                  data: response.data
                })
              )
              return null
            })
            .catch(emptyFunction)
          break
        case MessageType.factorial:
          requestHandlerPool
            .execute({ data }, 'factorial')
            .then(response => {
              ws.send(
                JSON.stringify({
                  type: MessageType.factorial,
                  data: response.data
                })
              )
              return null
            })
            .catch(emptyFunction)
          break
      }
    })
  })
  return {
    status: true,
    port: wss.options.port
  }
}

class WebSocketServerWorker extends ClusterWorker<
ClusterWorkerData,
ClusterWorkerResponse
> {
  public constructor () {
    super(startWebSocketServer)
  }
}

export const webSocketServerWorker = new WebSocketServerWorker()
