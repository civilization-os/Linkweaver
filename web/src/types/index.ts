// ─── Core domain types ───

export interface Field {
  name: string
  type: 'string' | 'int' | 'float' | 'bool' | 'datetime' | 'bytes'
  | 'ref' | 'array' | 'map' | 'struct' | 'enum' | 'union'
  primitiveType?: string
  ref?: string
  elementType?: Field
  keyType?: Field
  valueType?: Field
  fields?: Field[]
  enumValues?: string[]
  variants?: Field[]
  required?: boolean
  default?: string
  description?: string
}

export interface DataEntity {
  id: string
  name: string
  description?: string
  fields: Field[]
  tags?: string[]
}

export interface DataFlow {
  id: string
  sourceId: string       // node id
  sourcePort: PortSide
  targetId: string
  targetPort: PortSide
  label: string
  dataMappings?: string
  dir: 'fwd' | 'rev' | 'both'
}

export type PortSide = 't' | 'b' | 'l' | 'r'

export interface FlowNode {
  id: string
  type: 'entity' | 'actor' | 'process' | 'nested'
  label: string
  sublabel?: string
  fields?: Field[]
  x: number
  y: number
  regionId?: string
}

export interface Region {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
  color: string
  collapsed?: boolean
}

export interface Requirement {
  id: string
  title: string
  description?: string
  type: 'functional' | 'non-functional' | 'constraint'
  priority: 'must' | 'should' | 'may'
  status: 'draft' | 'reviewed' | 'approved' | 'rejected'
  criteria?: string[]
  scope?: string[]
  expression?: string
  category?: string
  nodeIds?: string[]
  edgeIds?: string[]
  regionIds?: string[]
}

export interface BusinessFlow {
  id: string
  name: string
  description?: string
  nodeIds: string[]
  edgeIds: string[]
}

// ─── Project ───

export interface Project {
  id: string
  name: string
  version: string
  description?: string
  nodes: FlowNode[]
  edges: DataFlow[]
  regions: Region[]
  requirements: Requirement[]
  businessFlows?: BusinessFlow[]
  createdAt: number
  updatedAt: number
}

// ─── Canvas state types ───

export interface ViewportState {
  x: number
  y: number
  scale: number
}

export interface NodePosition {
  x: number
  y: number
}
