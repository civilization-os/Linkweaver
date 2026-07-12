package models

// Field represents a field in a data entity
type Field struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Required    bool   `json:"required,omitempty"`
	Default     string `json:"default,omitempty"`
	Description string `json:"description,omitempty"`
	Ref         string `json:"ref,omitempty"`
}

// FlowNode represents a node on the canvas (entity/actor/process)
type FlowNode struct {
	ID        string  `json:"id"`
	Type      string  `json:"type"` // entity | actor | process | nested
	Label     string  `json:"label"`
	Sublabel  string  `json:"sublabel,omitempty"`
	Fields    []Field `json:"fields,omitempty"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	RegionID  string  `json:"regionId,omitempty"`
}

// DataFlow represents a connection between two nodes
type DataFlow struct {
	ID           string `json:"id"`
	SourceID     string `json:"sourceId"`
	SourcePort   string `json:"sourcePort"`
	TargetID     string `json:"targetId"`
	TargetPort   string `json:"targetPort"`
	Label        string `json:"label"`
	DataMappings string `json:"dataMappings,omitempty"`
	Dir          string `json:"dir"` // fwd | rev | both
}

// Region represents a service boundary on the canvas
type Region struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	W         float64 `json:"w"`
	H         float64 `json:"h"`
	Color     string  `json:"color"`
	Collapsed bool    `json:"collapsed,omitempty"`
}

// Requirement represents a functional or non-functional requirement
type Requirement struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description,omitempty"`
	Type        string   `json:"type"` // functional | non-functional | constraint
	Priority    string   `json:"priority"` // must | should | may
	Status      string   `json:"status"` // draft | reviewed | approved | rejected
	Criteria    []string `json:"criteria,omitempty"`
	Scope       []string `json:"scope,omitempty"`
	Expression  string   `json:"expression,omitempty"`
	Category    string   `json:"category,omitempty"`
}

// BusinessFlow represents a complete business scenario flow
type BusinessFlow struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	NodeIDs     []string `json:"nodeIds"`
	EdgeIDs     []string `json:"edgeIds"`
}

// Project is the top-level container
type Project struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Version       string         `json:"version"`
	Description   string         `json:"description,omitempty"`
	Nodes         []FlowNode     `json:"nodes"`
	Edges         []DataFlow     `json:"edges"`
	Regions       []Region       `json:"regions"`
	Requirements  []Requirement  `json:"requirements"`
	BusinessFlows []BusinessFlow `json:"businessFlows"`
	CreatedAt     int64          `json:"createdAt"`
	UpdatedAt     int64          `json:"updatedAt"`
}
