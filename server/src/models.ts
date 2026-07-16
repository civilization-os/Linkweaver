export interface Field {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description?: string;
  ref?: string;
}

export interface FlowNode {
  id: string;
  type: string; // entity | actor | process | nested
  label: string;
  sublabel?: string;
  fields?: Field[];
  x: number;
  y: number;
  regionId?: string;
}

export interface DataFlow {
  id: string;
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
  label: string;
  dataMappings?: string;
  dir: string; // fwd | rev | both
}

export interface Region {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  collapsed?: boolean;
}

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  criteria?: string[];
  scope?: string[];
  expression?: string;
  category?: string;
  nodeIds?: string[];
  edgeIds?: string[];
  regionIds?: string[];
}

export interface BusinessFlow {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface Project {
  id: string;
  name: string;
  version: string;
  description?: string;
  nodes: FlowNode[];
  edges: DataFlow[];
  regions: Region[];
  requirements: Requirement[];
  businessFlows: BusinessFlow[];
  createdAt: number;
  updatedAt: number;
}
