const WebSocket = require('ws')
const express = require('express')
const bodyParser = require('body-parser');
const axios = require('axios')

const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var children = []
var primary = false
var master_address = ""

const port = 3001
const address = "localhost"

var store = {}

const ws = new WebSocket(`ws://localhost:8888/enrol?port=${encodeURI(port)}&address=${encodeURI(address)}`)
ws.on('open', function open() {
  console.log('connected');
  ws.send(JSON.stringify({
    request: "get_primary"
  }))
});

ws.on('message', (e) => {
  try {
    temp = JSON.parse(e.toString('utf8'))

    children = temp
  }
  catch (_) {
    master_address = e.toString('utf8')
    if (master_address === `${address}:${port}`)
      return
    axios.get(`http://${master_address}/new_member?port=${encodeURI(port)}&address=${encodeURI(address)}`).then((res) => {
      store = {
        ...res.data
      }
    }).catch((err) => {
      console.log("neok")
    })
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.post('/store', (req, res) => {
  const keys = Object.keys(req.body)
  keys.forEach(e => {
    store[e] = req.body[e]
  });
  if (primary)
    children.forEach(e => {
      axios.post(`http://${e}/store`, req.body).then(() => {

      }).catch((e) => {
        console.log("err")
      })
    });
  res.send('Success')
})

app.get('/store', (req, res) => {
  const output = {}
  output[req.query.obtain] = store[req.query.obtain]
  res.send(output)
})

app.get('/new_member', (req, res) => {
  children.push(`${req.query.address}:${req.query.port}`)
  res.send(store)
})


app.get('/promoted', (req, res) => {
  primary = true
  console.log("This machine has been promoted!")
  ws.send(JSON.stringify({
    request: "get_all_secondary"
  }))
  res.send("Success")
})
