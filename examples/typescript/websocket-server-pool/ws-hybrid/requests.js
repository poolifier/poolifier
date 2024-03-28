// eslint-disable-next-line import/no-unresolved, n/no-missing-import
import { WebSocket } from 'ws'

const ws = new WebSocket('ws://localhost:8080')

ws.on('error', console.error)

ws.on('open', () => {
  for (let i = 0; i < 60; i++) {
    ws.send(
      JSON.stringify({ type: 'echo', data: { key1: 'value1', key2: 'value2' } })
    )
  }
  for (let i = 0; i < 60; i++) {
    ws.send(JSON.stringify({ type: 'factorial', data: { number: 50000 } }))
  }
})

ws.on('message', message => {
  console.info('message received: %s', message)
})
