package main

import (
	"encoding/json"
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

type reverse_proxy_request struct {
	Request string
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

func map_f[T, U any](data []T, f func(T) U) []U {

	res := make([]U, 0, len(data))

	for _, e := range data {
		res = append(res, f(e))
	}

	return res
}

func send_promote_req() {
	if len(connections) > 0 {
		link := "http://" + connections[0].ConnectionData.Address+":"+connections[0].ConnectionData.Port + "/promoted"
		_, e := http.Get(link)
		if(e != nil){
			print("uh oh")
		}
	}
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
			if len(connections) == 1{
				send_promote_req()
			}

			defer conn.Close()

			conn.SetCloseHandler(func(code int, text string) error {
				fmt.Printf("connection closed: %d %s\n", code, text)

				connections = filter(connections, func(e connection) bool {
					return !(e.ConnectionData.Address == address && e.ConnectionData.Port == port)
				})
				send_promote_req()
				return nil
			})

			for {
				_, data, err := conn.ReadMessage()
				if err != nil {
					connections = filter(connections, func(e connection) bool {
						return !(e.ConnectionData.Address == address && e.ConnectionData.Port == port)
					})
					send_promote_req()
					break
				}
				var reverse_proxt_req reverse_proxy_request
				json.Unmarshal(data, &reverse_proxt_req)

				switch reverse_proxt_req.Request {
				case "get_primary":
					if len(connections) > 0 {
						conn.WriteMessage(1, []byte(connections[0].ConnectionData.Address+":"+connections[0].ConnectionData.Port))
					} else {
						conn.WriteJSON("")
					}
				case "get_all_secondary":
					if len(connections) > 0 {
						temp_conn := filter(connections, func(e connection) bool {
							return !(e.ConnectionData.Address == connections[0].ConnectionData.Address && e.ConnectionData.Port == connections[0].ConnectionData.Port)
						})
						output := map_f(temp_conn, func(e connection) string {
							return e.ConnectionData.Address + ":" + e.ConnectionData.Port
						})
						conn.WriteJSON(output)
					}
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
