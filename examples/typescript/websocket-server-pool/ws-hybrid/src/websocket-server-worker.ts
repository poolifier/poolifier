import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ClusterWorker,
  DynamicThreadPool,
  availableParallelism
} from 'poolifier'
import { type RawData, WebSocketServer } from 'ws'
import {
  type ClusterWorkerData,
  type ClusterWorkerResponse,
  type DataPayload,
  type MessagePayload,
  MessageType,
  type ThreadWorkerData,
  type ThreadWorkerResponse
} from './types.js'

const emptyFunction = (): void => {
  /** Intentional */
}

class WebSocketServerWorker extends ClusterWorker<
ClusterWorkerData,
ClusterWorkerResponse
> {
  private static readonly startWebSocketServer = (
    workerData?: ClusterWorkerData
  ): ClusterWorkerResponse => {
    const { port } = workerData as ClusterWorkerData
    const wss = new WebSocketServer({ port }, () => {
      console.info(
        `⚡️[ws server]: WebSocket server is started in cluster worker at ws://localhost:${port}/`
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
            this.requestHandlerPool
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
            this.requestHandlerPool
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

  private static readonly requestHandlerWorkerFile = join(
    dirname(fileURLToPath(import.meta.url)),
    `request-handler-worker${extname(fileURLToPath(import.meta.url))}`
  )

  private static readonly requestHandlerPool = new DynamicThreadPool<
  ThreadWorkerData<DataPayload>,
  ThreadWorkerResponse<DataPayload>
  >(
    1,
    Math.round(availableParallelism() / 2),
    WebSocketServerWorker.requestHandlerWorkerFile,
    {
      enableTasksQueue: true,
      tasksQueueOptions: {
        concurrency: 8
      },
      errorHandler: (e: Error) => {
        console.error('Thread worker error:', e)
      }
    }
  )

  public constructor () {
    super(WebSocketServerWorker.startWebSocketServer)
  }
}

export const webSocketServerWorker = new WebSocketServerWorker()
