import express from 'express'
import { v4 as uuidv4, v4 } from 'uuid';
import { TaskTimer } from 'tasktimer';
import { writeFileSync, readFileSync, existsSync, unlinkSync, fstat, readdirSync } from 'fs'
import path from 'path'
import nocache from 'nocache'


const app = express()

app.use(nocache())

const COMMUNICATIONS = "communications"
const DICTIONARY = "dictionary"

const KEEP_ALIVE_INTERVAL = 1000
const timer = new TaskTimer(KEEP_ALIVE_INTERVAL);

const port = process.env.PORT
const myIp = process.env.MY_IP || `http://localhost:${port}`
const locationOfCommonDirectory = process.env.COMMON_DIR || "./temp"

const overSeerIp = process.env.OVERSEER_IP

if (overSeerIp == null) {
    console.log("No overseer IP.")
    process.exit(1)
}


let mainIp: string | null = null
let timestamp: Date

app.get("/set", (req, res) => {
    const queryParams = req.query
    if (mainIp != null) {
        let port = mainIp.split(":")[2]
        let index = req.originalUrl.indexOf("/set")
        return res.redirect(301, `http://localhost:${port}${req.originalUrl.slice(index)}`)
    }
    Object.keys(queryParams).forEach(
        e => {
            let filePath = path.join(locationOfCommonDirectory, DICTIONARY, e)
            if (queryParams[e] != undefined) {
                let asd: any = queryParams[e]
                if (typeof (asd) == typeof ("")) {
                    writeFileSync(filePath, asd)
                }
            }
        }
    );
    res.status(200).end()
})

app.get("/get/:id/", (req, res) => {
    if (mainIp != null) {
        let port = mainIp.split(":")[2]
        let index = req.originalUrl.indexOf("/get")
        return res.redirect(301, `http://localhost:${port}${req.originalUrl.slice(index)}`)
    }
    const queryParams = req.params.id
    let filePath = path.join(locationOfCommonDirectory, DICTIONARY, queryParams)
    let obj: any = {}
    let value = readFileSync(filePath, {
        encoding: "utf8"
    })
    res.json({
        data: value
    })
})

app.get("/ping", (req, res) => {
    console.log("Got pinged")
    timestamp = new Date()
    res.send({
        data: "pong"
    })
})

app.post("/register", express.json(), (req, res) => {
    if (mainIp != null) {
        return res.status(400).end()
    }
    const body = req.body
    const ip: string | null = body.ip
    if (ip == null) {
        return res.json(
            {
                error: "Missing ip body value."
            }
        )
    }
    try {
        timer.remove(ip)
    } catch (e) {
        null
    }
    timer.add(
        {
            id: ip,
            tickInterval: 1,
            callback(task) {
                console.log(`Start ping to ${ip}`)
                fetch(`${ip}/ping`).then((res) => {
                    if (!res.ok) {
                        console.log(`${ip} failed check`)
                        try {
                            timer.remove(task.id);
                        } catch (e) {
                            null
                        }
                    }
                }).catch((e) => {
                    console.log(e)
                    try {
                        timer.remove(task.id);
                    } catch (e) {
                        null
                    }
                })
            }
        }
    )
    return res.status(200).end()
})




app.listen(port, async () => {
    console.log(`App listening on port ${port}.`)
    const data = await fetch(`${overSeerIp}/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            ip: myIp
        })
    })
    if (!data.ok) {
        console.log("Could not reach overseer.")
        process.exit(1)
    }
    const json = await data.json()
    if (json.main === myIp) {
        console.log("I am main server.")
    } else {
        console.log(`Main server is ${json.main}`)
        const data = await fetch(`${json.main}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ip: myIp
            })
        })
        if (!data.ok) {
            console.log("Could not reach overseer.")
            process.exit(1)
        }
        mainIp = json.main

        timer.add({
            id: 'task-1',
            tickInterval: 2,
            callback(task) {
                if (mainIp != null && timestamp != null) {
                    if ((new Date().valueOf() - timestamp.valueOf()) > 2 * KEEP_ALIVE_INTERVAL) {
                        timer.remove(task.id)
                        console.log("Main has died")
                        let filename = v4()
                        let filePath = path.join(locationOfCommonDirectory, COMMUNICATIONS, filename)
                        writeFileSync(filePath, "")
                        setTimeout(async () => {
                            if (existsSync(filePath)) {
                                console.log("Main has really died.")
                                try {
                                    const data = await fetch(`${overSeerIp}/replace`, {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            ip: myIp,
                                            mainIp: mainIp
                                        })
                                    })
                                    if (!data.ok) {
                                        console.log("Could not reach overseer.")
                                        process.exit(1)
                                    }
                                    const json = await data.json()
                                    if (json.main === myIp) {
                                        console.log("I am main server.")
                                        mainIp = null
                                    } else {
                                        console.log(`Main server is ${json.main}`)
                                        try {
                                            const data = await fetch(`${json.main}/register`, {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({
                                                    ip: myIp
                                                })
                                            })
                                            if (!data.ok) {
                                                console.log("Could not reach main server.")
                                                process.exit(1)
                                            }
                                            mainIp = json.main
                                            timer.add(task)
                                        } catch (e) {
                                            console.log("Could not main server.")
                                            console.log(e)
                                            process.exit(1)
                                        }

                                    }
                                } catch (e) {
                                    console.log("Could not reach overseer.")
                                    console.log(e)
                                    process.exit(1)
                                }




                            } else {
                                console.log("Communication between main and this has died.")
                            }
                        }, KEEP_ALIVE_INTERVAL)
                    }
                }
            }
        })
    }
})

timer.on('tick', () => {
    // console.log('tick count: ' + timer.tickCount);
    // console.log('elapsed time: ' + timer.time.elapsed + ' ms.');
    if (mainIp == null) {
        const dirpath = path.join(locationOfCommonDirectory, COMMUNICATIONS)
        let fileObjs = readdirSync(dirpath, { withFileTypes: true });

        fileObjs.forEach(file => {
            unlinkSync(path.join(dirpath, file.name))
        });
    }

    // stop timer (and all tasks) after 1 hour
    if (mainIp != null)
        if (timer.tickCount >= 3600000) timer.stop();
});

// Start the timer
timer.start();