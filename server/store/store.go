package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/reqflow/server/models"
)

// Store manages project persistence using JSON files
type Store struct {
	mu        sync.RWMutex
	dataDir   string
	projects  map[string]*models.Project
}

// NewStore creates a store, loading existing data
func NewStore(dataDir string) (*Store, error) {
	if dataDir == "" {
		home, _ := os.UserHomeDir()
		dataDir = filepath.Join(home, ".reqflow")
	}
	os.MkdirAll(dataDir, 0755)

	s := &Store{
		dataDir:  dataDir,
		projects: make(map[string]*models.Project),
	}

	if err := s.load(); err != nil {
		return s, nil // start fresh if no data
	}
	return s, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "projects.json"))
	if err != nil {
		return err
	}
	var projects []*models.Project
	if err := json.Unmarshal(data, &projects); err != nil {
		return err
	}
	for _, p := range projects {
		s.projects[p.ID] = p
	}
	return nil
}

func (s *Store) save() error {
	projects := make([]*models.Project, 0, len(s.projects))
	for _, p := range s.projects {
		projects = append(projects, p)
	}
	data, err := json.MarshalIndent(projects, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "projects.json"), data, 0644)
}

func now() int64 { return time.Now().UnixMilli() }

// ─── Project operations ───

func (s *Store) ListProjects() []*models.Project {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*models.Project, 0, len(s.projects))
	for _, p := range s.projects {
		result = append(result, p)
	}
	return result
}

func (s *Store) GetProject(id string) *models.Project {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.projects[id]
}

func (s *Store) CreateProject(name string) (*models.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := fmt.Sprintf("proj-%x", time.Now().UnixNano())
	p := &models.Project{
		ID:        id,
		Name:      name,
		Version:   "v1.0",
		Nodes:     []models.FlowNode{},
		Edges:     []models.DataFlow{},
		Regions:   []models.Region{},
		CreatedAt: now(),
		UpdatedAt: now(),
	}
	s.projects[id] = p
	return p, s.save()
}

func (s *Store) DeleteProject(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[id]; !ok {
		return false
	}
	delete(s.projects, id)
	s.save()
	return true
}

func (s *Store) UpdateProject(id string, name, version, description string) *models.Project {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[id]
	if !ok {
		return nil
	}
	if name != "" {
		p.Name = name
	}
	if version != "" {
		p.Version = version
	}
	if description != "" {
		p.Description = description
	}
	p.UpdatedAt = now()
	s.save()
	return p
}

// ─── Node operations ───

func (s *Store) AddNode(projectID string, node models.FlowNode) *models.FlowNode {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	node.ID = fmt.Sprintf("n-%x", time.Now().UnixNano())
	p.Nodes = append(p.Nodes, node)
	p.UpdatedAt = now()
	s.save()
	return &node
}

func (s *Store) UpdateNode(projectID, nodeID string, updates map[string]interface{}) *models.FlowNode {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	for i, n := range p.Nodes {
		if n.ID == nodeID {
			if v, ok := updates["label"]; ok {
				p.Nodes[i].Label = v.(string)
			}
			if v, ok := updates["type"]; ok {
				p.Nodes[i].Type = v.(string)
			}
			if v, ok := updates["x"]; ok {
				p.Nodes[i].X = v.(float64)
			}
			if v, ok := updates["y"]; ok {
				p.Nodes[i].Y = v.(float64)
			}
			if v, ok := updates["regionId"]; ok {
				if v == nil {
					p.Nodes[i].RegionID = ""
				} else {
					p.Nodes[i].RegionID = v.(string)
				}
			}
			if v, ok := updates["fields"]; ok {
				p.Nodes[i].Fields = v.([]models.Field)
			}
			p.UpdatedAt = now()
			s.save()
			return &p.Nodes[i]
		}
	}
	return nil
}

func (s *Store) DeleteNode(projectID, nodeID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return false
	}
	for i, n := range p.Nodes {
		if n.ID == nodeID {
			p.Nodes = append(p.Nodes[:i], p.Nodes[i+1:]...)
			// Remove related edges
			filtered := p.Edges[:0]
			for _, e := range p.Edges {
				if e.SourceID != nodeID && e.TargetID != nodeID {
					filtered = append(filtered, e)
				}
			}
			p.Edges = filtered
			p.UpdatedAt = now()
			s.save()
			return true
		}
	}
	return false
}

// ─── Edge operations ───

func (s *Store) AddEdge(projectID string, edge models.DataFlow) *models.DataFlow {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	edge.ID = fmt.Sprintf("e-%x", time.Now().UnixNano())
	p.Edges = append(p.Edges, edge)
	p.UpdatedAt = now()
	s.save()
	return &edge
}

func (s *Store) UpdateEdge(projectID, edgeID string, dir string) *models.DataFlow {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	for i, e := range p.Edges {
		if e.ID == edgeID {
			if dir != "" {
				p.Edges[i].Dir = dir
			}
			p.UpdatedAt = now()
			s.save()
			return &p.Edges[i]
		}
	}
	return nil
}

func (s *Store) DeleteEdge(projectID string, edgeIdx int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return false
	}
	if edgeIdx < 0 || edgeIdx >= len(p.Edges) {
		return false
	}
	p.Edges = append(p.Edges[:edgeIdx], p.Edges[edgeIdx+1:]...)
	p.UpdatedAt = now()
	s.save()
	return true
}

// ─── Region operations ───

func (s *Store) AddRegion(projectID string, region models.Region) *models.Region {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	region.ID = fmt.Sprintf("r-%x", time.Now().UnixNano())
	p.Regions = append(p.Regions, region)
	p.UpdatedAt = now()
	s.save()
	return &region
}

func (s *Store) UpdateRegion(projectID, regionID string, updates map[string]interface{}) *models.Region {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	for i, r := range p.Regions {
		if r.ID == regionID {
			if v, ok := updates["title"]; ok {
				p.Regions[i].Title = v.(string)
			}
			if v, ok := updates["x"]; ok {
				p.Regions[i].X = v.(float64)
			}
			if v, ok := updates["y"]; ok {
				p.Regions[i].Y = v.(float64)
			}
			if v, ok := updates["w"]; ok {
				p.Regions[i].W = v.(float64)
			}
			if v, ok := updates["h"]; ok {
				p.Regions[i].H = v.(float64)
			}
			if v, ok := updates["color"]; ok {
				p.Regions[i].Color = v.(string)
			}
			if v, ok := updates["collapsed"]; ok {
				p.Regions[i].Collapsed = v.(bool)
			}
			p.UpdatedAt = now()
			s.save()
			return &p.Regions[i]
		}
	}
	return nil
}

func (s *Store) DeleteRegion(projectID, regionID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return false
	}
	for i, r := range p.Regions {
		if r.ID == regionID {
			p.Regions = append(p.Regions[:i], p.Regions[i+1:]...)
			// Unlink nodes from this region
			for j := range p.Nodes {
				if p.Nodes[j].RegionID == regionID {
					p.Nodes[j].RegionID = ""
				}
			}
			p.UpdatedAt = now()
			s.save()
			return true
		}
	}
	return false
}

// ─── BusinessFlow operations ───

func (s *Store) AddBusinessFlow(projectID string, flow models.BusinessFlow) *models.BusinessFlow {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	flow.ID = fmt.Sprintf("flow-%x", time.Now().UnixNano())
	if flow.NodeIDs == nil {
		flow.NodeIDs = []string{}
	}
	if flow.EdgeIDs == nil {
		flow.EdgeIDs = []string{}
	}
	p.BusinessFlows = append(p.BusinessFlows, flow)
	p.UpdatedAt = now()
	s.save()
	return &flow
}

func (s *Store) UpdateBusinessFlow(projectID, flowID string, updates map[string]interface{}) *models.BusinessFlow {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return nil
	}
	for i, f := range p.BusinessFlows {
		if f.ID == flowID {
			if v, ok := updates["name"]; ok {
				p.BusinessFlows[i].Name = v.(string)
			}
			if v, ok := updates["description"]; ok {
				p.BusinessFlows[i].Description = v.(string)
			}
			if v, ok := updates["nodeIds"]; ok {
				var ids []string
				if strSlice, ok := v.([]string); ok {
					ids = strSlice
				} else if ifaceSlice, ok := v.([]interface{}); ok {
					for _, val := range ifaceSlice {
						if strVal, ok := val.(string); ok {
							ids = append(ids, strVal)
						}
					}
				}
				p.BusinessFlows[i].NodeIDs = ids
			}
			if v, ok := updates["edgeIds"]; ok {
				var ids []string
				if strSlice, ok := v.([]string); ok {
					ids = strSlice
				} else if ifaceSlice, ok := v.([]interface{}); ok {
					for _, val := range ifaceSlice {
						if strVal, ok := val.(string); ok {
							ids = append(ids, strVal)
						}
					}
				}
				p.BusinessFlows[i].EdgeIDs = ids
			}
			p.UpdatedAt = now()
			s.save()
			return &p.BusinessFlows[i]
		}
	}
	return nil
}

func (s *Store) DeleteBusinessFlow(projectID, flowID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[projectID]
	if !ok {
		return false
	}
	for i, f := range p.BusinessFlows {
		if f.ID == flowID {
			p.BusinessFlows = append(p.BusinessFlows[:i], p.BusinessFlows[i+1:]...)
			p.UpdatedAt = now()
			s.save()
			return true
		}
	}
	return false
}
