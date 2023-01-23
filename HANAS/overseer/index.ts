import express from 'express'

const app = express()

const port = process.env.PORT || 4000

let servers: string[] = []

let main: string | null = null

app.get("/", (req, res) => {
    const queryParams = req.query
    const shouldSendAll = queryParams.all != undefined

    if (shouldSendAll) {
        res.json(
            {
                servers,
                main
            }
        )
    } else {
        res.json(
            {
                main: main,
            }
        )
    }
})

function addServer(ip: string) {
    if (servers.includes(ip)) {
        return
    }
    servers.push(ip)
    if (main == null) {
        main = ip
    }
}

function replaceMain(ip: string) {
    if (main == null) {
        return
    }
    servers = servers.filter(
        (e) => {
            e == main
        }
    )
    if (!servers.includes(ip)) {
        servers.push(ip)
    }
    main = ip
}

function clearServers() {
    main = null
    servers = []
}

app.post("/register", express.json(), (req, res) => {
    const body = req.body
    const ip: string | null = body.ip
    if (ip == null) {
        return res.json(
            {
                error: "Missing ip body value."
            }
        )
    }
    addServer(ip)
    res.json({

        main
    })
})


app.post("/replace", express.json(), (req, res) => {
    const body = req.body
    const ip: string | null = body.ip
    const saidMainIp: string | null = body.mainIp
    if (ip == null || saidMainIp == null) {
        return res.json(
            {
                error: "Missing ip or mainIp body value."
            }
        )
    }
    if (saidMainIp == main) {
        main = null
        clearServers()
    }
    addServer(ip)
    res.json({
        main
    })
})


app.listen(port, () => {
    console.log(`App listening on port ${port}.`)
})