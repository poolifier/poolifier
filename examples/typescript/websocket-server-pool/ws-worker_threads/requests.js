import { WebSocket } from 'ws'

const ws = new WebSocket('ws://localhost:8080')

ws.on('error', console.error)

ws.on('open', () => {
  for (let i = 0; i < 60; i++) {
    ws.send(
      JSON.stringify({ data: { key1: 'value1', key2: 'value2' }, type: 'echo' })
    )
  }
  for (let i = 0; i < 60; i++) {
    ws.send(JSON.stringify({ data: { number: 50000 }, type: 'factorial' }))
  }
})

ws.on('message', message => {
  console.info('message received: %s', message)
})
