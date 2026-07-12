package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/reqflow/server/models"
	"github.com/reqflow/server/store"
)

var apiStore *store.Store

func startAPI() {
	dataDir := os.Getenv("REQFLOW_DATA_DIR")
	var err error
	apiStore, err = store.NewStore(dataDir)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}

	port := os.Getenv("REQFLOW_API_PORT")
	if port == "" {
		port = "8081"
	}

	mux := http.NewServeMux()

	// CORS middleware
	handler := corsMiddleware(mux)

	// ─── Projects ───
	mux.HandleFunc("/api/projects", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.Method {
		case "GET":
			projects := apiStore.ListProjects()
			json.NewEncoder(w).Encode(projects)
		case "POST":
			var body struct {
				Name string `json:"name"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, `{"error":"invalid request"}`, 400)
				return
			}
			p, err := apiStore.CreateProject(body.Name)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, 500)
				return
			}
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(p)
		default:
			http.Error(w, "", 405)
		}
	})

	mux.HandleFunc("/api/projects/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/projects/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			http.Error(w, "", 404)
			return
		}
		projectID := parts[0]

		switch {
		case len(parts) == 1:
			switch r.Method {
			case "GET":
				p := apiStore.GetProject(projectID)
				if p == nil {
					http.Error(w, `{"error":"not found"}`, 404)
					return
				}
				json.NewEncoder(w).Encode(p)
			case "DELETE":
				if apiStore.DeleteProject(projectID) {
					w.WriteHeader(204)
				} else {
					http.Error(w, `{"error":"not found"}`, 404)
				}
			default:
				http.Error(w, "", 405)
			}

		case parts[1] == "nodes":
			handleNodes(w, r, projectID, parts)

		case parts[1] == "edges":
			handleEdges(w, r, projectID, parts)

		case parts[1] == "regions":
			handleRegions(w, r, projectID, parts)

		case parts[1] == "business-flows":
			handleBusinessFlows(w, r, projectID, parts)

		default:
			http.Error(w, "", 404)
		}
	})

	log.Printf("ReqFlow API running on http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("API server error: %v", err)
	}
}

func handleNodes(w http.ResponseWriter, r *http.Request, projectID string, parts []string) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case "POST":
		var node models.FlowNode
		if err := json.NewDecoder(r.Body).Decode(&node); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.AddNode(projectID, node)
		if result == nil {
			http.Error(w, `{"error":"project not found"}`, 404)
			return
		}
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(result)

	case "PUT":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		nodeID := parts[2]
		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.UpdateNode(projectID, nodeID, updates)
		if result == nil {
			http.Error(w, `{"error":"not found"}`, 404)
			return
		}
		json.NewEncoder(w).Encode(result)

	case "DELETE":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		nodeID := parts[2]
		if apiStore.DeleteNode(projectID, nodeID) {
			w.WriteHeader(204)
		} else {
			http.Error(w, `{"error":"not found"}`, 404)
		}

	default:
		http.Error(w, "", 405)
	}
}

func handleEdges(w http.ResponseWriter, r *http.Request, projectID string, parts []string) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case "POST":
		var edge models.DataFlow
		if err := json.NewDecoder(r.Body).Decode(&edge); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.AddEdge(projectID, edge)
		if result == nil {
			http.Error(w, `{"error":"project not found"}`, 404)
			return
		}
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(result)

	case "DELETE":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		idx, err := strconv.Atoi(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid index"}`, 400)
			return
		}
		if apiStore.DeleteEdge(projectID, idx) {
			w.WriteHeader(204)
		} else {
			http.Error(w, `{"error":"not found"}`, 404)
		}

	default:
		http.Error(w, "", 405)
	}
}

func handleRegions(w http.ResponseWriter, r *http.Request, projectID string, parts []string) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case "POST":
		var region models.Region
		if err := json.NewDecoder(r.Body).Decode(&region); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.AddRegion(projectID, region)
		if result == nil {
			http.Error(w, `{"error":"project not found"}`, 404)
			return
		}
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(result)

	case "PUT":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		regionID := parts[2]
		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.UpdateRegion(projectID, regionID, updates)
		if result == nil {
			http.Error(w, `{"error":"not found"}`, 404)
			return
		}
		json.NewEncoder(w).Encode(result)

	case "DELETE":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		regionID := parts[2]
		if apiStore.DeleteRegion(projectID, regionID) {
			w.WriteHeader(204)
		} else {
			http.Error(w, `{"error":"not found"}`, 404)
		}

	default:
		http.Error(w, "", 405)
	}
}

func handleBusinessFlows(w http.ResponseWriter, r *http.Request, projectID string, parts []string) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case "POST":
		var flow models.BusinessFlow
		if err := json.NewDecoder(r.Body).Decode(&flow); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.AddBusinessFlow(projectID, flow)
		if result == nil {
			http.Error(w, `{"error":"project not found"}`, 404)
			return
		}
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(result)

	case "PUT":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		flowID := parts[2]
		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, `{"error":"invalid request"}`, 400)
			return
		}
		result := apiStore.UpdateBusinessFlow(projectID, flowID, updates)
		if result == nil {
			http.Error(w, `{"error":"not found"}`, 404)
			return
		}
		json.NewEncoder(w).Encode(result)

	case "DELETE":
		if len(parts) < 3 {
			http.Error(w, "", 400)
			return
		}
		flowID := parts[2]
		if apiStore.DeleteBusinessFlow(projectID, flowID) {
			w.WriteHeader(204)
		} else {
			http.Error(w, `{"error":"not found"}`, 404)
		}

	default:
		http.Error(w, "", 405)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
