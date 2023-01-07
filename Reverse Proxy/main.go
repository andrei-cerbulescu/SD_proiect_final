package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gorilla/websocket"
)

type enrol_request struct {
	Port    string
	Address string
}

type connection struct {
	ConnectionData enrol_request
}

var connections []connection

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func filter[T any](data []T, f func(T) bool) []T {

	fltd := make([]T, 0, len(data))

	for _, e := range data {
		if f(e) {
			fltd = append(fltd, e)
		}
	}

	return fltd
}

func main() {

	go func() {
		http.HandleFunc("/enrol", func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)

			address := r.URL.Query().Get("address")
			port := r.URL.Query().Get("port")

			if err != nil {
				fmt.Println("upgrade:", err)
				return
			}

			var new_conn_data enrol_request
			new_conn_data.Address = address
			new_conn_data.Port = port

			var new_con connection
			new_con.ConnectionData = new_conn_data 
			connections = append(connections, new_con)

			defer conn.Close()

			conn.SetCloseHandler(func(code int, text string) error {
				fmt.Printf("connection closed: %d %s\n", code, text)

				connections = filter(connections, func(e connection) bool {
					return !(e.ConnectionData.Address == address && e.ConnectionData.Port == port)
				})
				return nil
			})

			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					connections = filter(connections, func(e connection) bool {
						return !(e.ConnectionData.Address == address && e.ConnectionData.Port == port)
					})
					break
			}
			}
		})

		http.ListenAndServe(":8888", nil)
	}()

	go func() {
		proxy := httputil.NewSingleHostReverseProxy(&url.URL{
			Scheme: "http",
			Host:   "localhost:3000",
		})
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {

			proxy.Director = func(req *http.Request) {
				req.URL.Scheme = "http"
				req.URL.Host = connections[0].ConnectionData.Address + ":" + connections[0].ConnectionData.Port
			}

			proxy.ServeHTTP(w, r)
		})

		fmt.Println("Reverse proxy running on port 8080")

		if err := http.ListenAndServe(":8080", nil); err != nil {
			panic(err)
		}
	}()

	select {}
}
