package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	mcp "github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/reqflow/server/models"
	"github.com/reqflow/server/store"
)

var s *store.Store

func main() {
	dataDir := os.Getenv("REQFLOW_DATA_DIR")
	var err error
	s, err = store.NewStore(dataDir)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}

	args := os.Args[1:]
	sseMode := len(args) > 0 && args[0] == "--sse"

	// Start REST API in background (only in SSE mode to avoid port conflicts with MCP tools)
	if sseMode {
		go startAPI()
	}

	svr := server.NewMCPServer(
		"ReqFlow MCP",
		"1.0.0",
	)

	// ─── Project tools ───
	svr.AddTool(mcp.NewTool("list_projects", mcp.WithDescription("List all projects")),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			projects := s.ListProjects()
			data, _ := json.MarshalIndent(projects, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		})

	svr.AddTool(mcp.NewTool("get_project",
		mcp.WithDescription("Get project details by ID"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		p := s.GetProject(id)
		if p == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(p, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	svr.AddTool(mcp.NewTool("create_project",
		mcp.WithDescription("Create a new project"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Project name")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		name := req.GetString("name", "")
		p, err := s.CreateProject(name)
		if err != nil {
			return mcp.NewToolResultText(fmt.Sprintf("Error: %v", err)), nil
		}
		data, _ := json.MarshalIndent(p, "", "  ")
		return mcp.NewToolResultText(fmt.Sprintf("Project created:\n%s", string(data))), nil
	})

	svr.AddTool(mcp.NewTool("delete_project",
		mcp.WithDescription("Delete a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		if s.DeleteProject(id) {
			return mcp.NewToolResultText(fmt.Sprintf("Project %s deleted", id)), nil
		}
		return mcp.NewToolResultText("Project not found"), nil
	})

	// ─── Entity tools ───
	svr.AddTool(mcp.NewTool("list_entities",
		mcp.WithDescription("List all entities in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		p := s.GetProject(id)
		if p == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(p.Nodes, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	svr.AddTool(mcp.NewTool("create_entity",
		mcp.WithDescription("Create a new data entity in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Entity name")),
		mcp.WithString("type", mcp.Description("Entity type: entity|actor|process|nested")),
		mcp.WithString("fields_json", mcp.Description("Fields as JSON array")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		name := req.GetString("name", "")
		entityType := req.GetString("type", "entity")

		var fields []models.Field
		if f := req.GetString("fields_json", ""); f != "" {
			json.Unmarshal([]byte(f), &fields)
		}

		labelMap := map[string]string{"entity": "实体", "actor": "外部", "process": "流程", "nested": "嵌套"}
		node := models.FlowNode{
			Type: entityType, Label: name, Sublabel: labelMap[entityType],
			Fields: fields, X: 300, Y: 300,
		}
		result := s.AddNode(projectID, node)
		if result == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(result, "", "  ")
		return mcp.NewToolResultText(fmt.Sprintf("Entity created:\n%s", string(data))), nil
	})

	svr.AddTool(mcp.NewTool("delete_entity",
		mcp.WithDescription("Delete an entity by ID"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("entity_id", mcp.Required(), mcp.Description("Entity ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		entityID := req.GetString("entity_id", "")
		if s.DeleteNode(projectID, entityID) {
			return mcp.NewToolResultText(fmt.Sprintf("Entity %s deleted", entityID)), nil
		}
		return mcp.NewToolResultText("Entity not found"), nil
	})

	// ─── Flow tools ───
	svr.AddTool(mcp.NewTool("list_flows",
		mcp.WithDescription("List all data flows in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		p := s.GetProject(id)
		if p == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(p.Edges, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	svr.AddTool(mcp.NewTool("create_flow",
		mcp.WithDescription("Create a data flow between two entities"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("source_id", mcp.Required(), mcp.Description("Source entity ID")),
		mcp.WithString("target_id", mcp.Required(), mcp.Description("Target entity ID")),
		mcp.WithString("label", mcp.Description("Flow label/name")),
		mcp.WithString("dir", mcp.Description("Direction: fwd|rev|both")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		sourceID := req.GetString("source_id", "")
		targetID := req.GetString("target_id", "")
		dir := req.GetString("dir", "fwd")

		edge := models.DataFlow{
			SourceID: sourceID, SourcePort: "r",
			TargetID: targetID, TargetPort: "l",
			Label: fmt.Sprintf("%s → %s", sourceID[:min(6, len(sourceID))], targetID[:min(6, len(targetID))]),
			Dir: dir,
		}
		if l := req.GetString("label", ""); l != "" {
			edge.Label = l
		}
		result := s.AddEdge(projectID, edge)
		if result == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(result, "", "  ")
		return mcp.NewToolResultText(fmt.Sprintf("Flow created:\n%s", string(data))), nil
	})

	svr.AddTool(mcp.NewTool("delete_flow",
		mcp.WithDescription("Delete a data flow by index"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithNumber("flow_idx", mcp.Required(), mcp.Description("Flow index (0-based)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		idx := int(req.GetFloat("flow_idx", -1))
		if s.DeleteEdge(projectID, idx) {
			return mcp.NewToolResultText(fmt.Sprintf("Flow at index %d deleted", idx)), nil
		}
		return mcp.NewToolResultText("Flow not found"), nil
	})

	// ─── Region tools ───
	svr.AddTool(mcp.NewTool("list_regions",
		mcp.WithDescription("List all regions in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		p := s.GetProject(id)
		if p == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(p.Regions, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	svr.AddTool(mcp.NewTool("create_region",
		mcp.WithDescription("Create a service region in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("title", mcp.Required(), mcp.Description("Region title")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		title := req.GetString("title", "")
		region := models.Region{Title: title, X: 200, Y: 200, W: 300, H: 300, Color: "#f0f0f0"}
		result := s.AddRegion(projectID, region)
		if result == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(result, "", "  ")
		return mcp.NewToolResultText(fmt.Sprintf("Region created:\n%s", string(data))), nil
	})

	svr.AddTool(mcp.NewTool("delete_region",
		mcp.WithDescription("Delete a region"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("region_id", mcp.Required(), mcp.Description("Region ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		regionID := req.GetString("region_id", "")
		if s.DeleteRegion(projectID, regionID) {
			return mcp.NewToolResultText(fmt.Sprintf("Region %s deleted", regionID)), nil
		}
		return mcp.NewToolResultText("Region not found"), nil
	})

	// ─── Query tool ───
	svr.AddTool(mcp.NewTool("query_project",
		mcp.WithDescription("Get a full project overview with all entities, flows, and regions"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		p := s.GetProject(id)
		if p == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		summary := fmt.Sprintf(`# %s %s
- Entities: %d
- Data Flows: %d
- Regions: %d

## Entities
%s

## Data Flows
%s

## Regions
%s`,
			p.Name, p.Version, len(p.Nodes), len(p.Edges), len(p.Regions),
			formatEntities(p.Nodes), formatFlows(p.Edges), formatRegions(p.Regions))
		return mcp.NewToolResultText(summary), nil
	})

	// ─── Business Flow tools ───
	svr.AddTool(mcp.NewTool("list_business_flows",
		mcp.WithDescription("List all business flows in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id := req.GetString("project_id", "")
		p := s.GetProject(id)
		if p == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(p.BusinessFlows, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	svr.AddTool(mcp.NewTool("create_business_flow",
		mcp.WithDescription("Create a business flow in a project"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Flow name")),
		mcp.WithString("description", mcp.Description("Flow description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		name := req.GetString("name", "")
		desc := req.GetString("description", "")
		flow := models.BusinessFlow{
			Name:        name,
			Description: desc,
			NodeIDs:     []string{},
			EdgeIDs:     []string{},
		}
		result := s.AddBusinessFlow(projectID, flow)
		if result == nil {
			return mcp.NewToolResultText("Project not found"), nil
		}
		data, _ := json.MarshalIndent(result, "", "  ")
		return mcp.NewToolResultText(fmt.Sprintf("Business Flow created:\n%s", string(data))), nil
	})

	svr.AddTool(mcp.NewTool("update_business_flow",
		mcp.WithDescription("Update a business flow's properties, nodes, or edges"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("flow_id", mcp.Required(), mcp.Description("Business Flow ID")),
		mcp.WithString("name", mcp.Description("Flow name")),
		mcp.WithString("description", mcp.Description("Flow description")),
		mcp.WithString("node_ids_json", mcp.Description("JSON array of node IDs")),
		mcp.WithString("edge_ids_json", mcp.Description("JSON array of edge IDs")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		flowID := req.GetString("flow_id", "")
		updates := make(map[string]interface{})
		if n := req.GetString("name", ""); n != "" {
			updates["name"] = n
		}
		if d := req.GetString("description", ""); d != "" {
			updates["description"] = d
		}
		if nj := req.GetString("node_ids_json", ""); nj != "" {
			var nodeIDs []string
			if err := json.Unmarshal([]byte(nj), &nodeIDs); err != nil {
				return mcp.NewToolResultText("Invalid node_ids_json format"), nil
			}
			updates["nodeIds"] = nodeIDs
		}
		if ej := req.GetString("edge_ids_json", ""); ej != "" {
			var edgeIDs []string
			if err := json.Unmarshal([]byte(ej), &edgeIDs); err != nil {
				return mcp.NewToolResultText("Invalid edge_ids_json format"), nil
			}
			updates["edgeIds"] = edgeIDs
		}
		result := s.UpdateBusinessFlow(projectID, flowID, updates)
		if result == nil {
			return mcp.NewToolResultText("Business Flow not found"), nil
		}
		data, _ := json.MarshalIndent(result, "", "  ")
		return mcp.NewToolResultText(fmt.Sprintf("Business Flow updated:\n%s", string(data))), nil
	})

	svr.AddTool(mcp.NewTool("delete_business_flow",
		mcp.WithDescription("Delete a business flow"),
		mcp.WithString("project_id", mcp.Required(), mcp.Description("Project ID")),
		mcp.WithString("flow_id", mcp.Required(), mcp.Description("Business Flow ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		projectID := req.GetString("project_id", "")
		flowID := req.GetString("flow_id", "")
		if s.DeleteBusinessFlow(projectID, flowID) {
			return mcp.NewToolResultText(fmt.Sprintf("Business Flow %s deleted", flowID)), nil
		}
		return mcp.NewToolResultText("Business Flow not found"), nil
	})

	// Start
	if len(os.Args) > 1 && os.Args[1] == "--sse" {
		sseServer := server.NewSSEServer(svr, server.WithBaseURL("http://localhost:8080"))
		log.Printf("ReqFlow MCP running on http://localhost:8080")
		if err := sseServer.Start(":8080"); err != nil {
			log.Fatalf("Server error: %v", err)
		}
	} else {
		log.Printf("ReqFlow MCP starting in stdio mode...")
		if err := server.ServeStdio(svr); err != nil {
			log.Fatalf("Server error: %v", err)
		}
	}
}

func formatEntities(nodes []models.FlowNode) string {
	if len(nodes) == 0 {
		return "(none)"
	}
	var result string
	for _, n := range nodes {
		result += fmt.Sprintf("- %s (%s)", n.Label, n.Sublabel)
		if n.RegionID != "" {
			result += fmt.Sprintf(" [in: %s]", n.RegionID)
		}
		result += "\n"
		for _, f := range n.Fields {
			result += fmt.Sprintf("  - %s (%s)\n", f.Name, f.Type)
		}
	}
	return result
}

func formatFlows(edges []models.DataFlow) string {
	if len(edges) == 0 {
		return "(none)"
	}
	var result string
	for i, e := range edges {
		result += fmt.Sprintf("%d. %s (%s)\n", i, e.Label, e.Dir)
	}
	return result
}

func formatRegions(regions []models.Region) string {
	if len(regions) == 0 {
		return "(none)"
	}
	var result string
	for _, r := range regions {
		result += fmt.Sprintf("- %s\n", r.Title)
	}
	return result
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
