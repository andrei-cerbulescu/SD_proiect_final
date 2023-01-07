const WebSocket = require('ws')
const express = require('express')
const app = express()
const port = 3000
const address = "localhost"

const ws = new WebSocket(`ws://localhost:8888/enrol?port=${encodeURI(port)}&address=${encodeURI(address)}`)
ws.on('open', function open() {
  console.log('connected');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.get('/', (req, res) => {
  res.send('Hello World!')
})
