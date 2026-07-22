import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import lockfile from 'proper-lockfile';
import { Project, FlowNode, DataFlow, Region, BusinessFlow, Field, Requirement } from './models.js';
import crypto from 'crypto';
import dagre from 'dagre';

export interface ProjectValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  regionId?: string;
  requirementId?: string;
  businessFlowId?: string;
  fieldName?: string;
}

export interface ProjectValidationResult {
  projectId: string;
  name: string;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    total: number;
  };
  issues: ProjectValidationIssue[];
}

function generateId(prefix: string): string {
  return prefix + crypto.randomBytes(4).toString('hex');
}

function now(): number {
  return Date.now();
}

export class Store {
  private dataDir: string;
  private filePath: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(os.homedir(), '.linkweaver');
    this.filePath = path.join(this.dataDir, 'projects.json');
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]', 'utf8');
    }
  }

  private async withLock<T>(action: (projects: Project[]) => Promise<{ result: T, mutate: boolean }> | { result: T, mutate: boolean }): Promise<T> {
    const release = await lockfile.lock(this.filePath, { retries: { retries: 5, minTimeout: 100 } });
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const projects: Project[] = JSON.parse(data);
      const { result, mutate } = await action(projects);
      if (mutate) {
        await fs.writeFile(this.filePath, JSON.stringify(projects, null, 2), 'utf8');
      }
      return result;
    } finally {
      await release();
    }
  }

  async listProjects(): Promise<Project[]> {
    const data = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(data);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const projects = await this.listProjects();
    return projects.find(p => p.id === id);
  }

  async createProject(name: string): Promise<Project> {
    return this.withLock(projects => {
      const p: Project = {
        id: generateId('proj-'),
        name,
        version: 'v1.0',
        nodes: [],
        edges: [],
        regions: [],
        requirements: [],
        businessFlows: [],
        createdAt: now(),
        updatedAt: now()
      };
      projects.push(p);
      return { result: p, mutate: true };
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.withLock(projects => {
      const index = projects.findIndex(p => p.id === id);
      if (index === -1) return { result: false, mutate: false };
      projects.splice(index, 1);
      return { result: true, mutate: true };
    });
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === id);
      if (!p) return { result: null, mutate: false };
      
      if (updates.name !== undefined) p.name = updates.name;
      if (updates.version !== undefined) p.version = updates.version;
      if (updates.description !== undefined) p.description = updates.description;
      
      p.updatedAt = now();
      return { result: p, mutate: true };
    });
  }

  async addNode(projectId: string, node: Partial<FlowNode>): Promise<FlowNode | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const newNode: FlowNode = {
        id: generateId('n-'),
        type: node.type || 'entity',
        label: node.label || '',
        sublabel: node.sublabel,
        fields: node.fields || [],
        x: node.x || 300,
        y: node.y || 300,
        regionId: node.regionId
      };
      
      p.nodes.push(newNode);
      p.updatedAt = now();
      return { result: newNode, mutate: true };
    });
  }

  async updateNode(projectId: string, nodeId: string, updates: Partial<FlowNode>): Promise<FlowNode | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const node = p.nodes.find(n => n.id === nodeId);
      if (!node) return { result: null, mutate: false };

      if (updates.label !== undefined) node.label = updates.label;
      if (updates.type !== undefined) node.type = updates.type;
      if (updates.x !== undefined) node.x = updates.x;
      if (updates.y !== undefined) node.y = updates.y;
      if (updates.regionId !== undefined) node.regionId = updates.regionId;
      if (updates.fields !== undefined) node.fields = updates.fields;
      
      p.updatedAt = now();
      return { result: node, mutate: true };
    });
  }

  async deleteNode(projectId: string, nodeId: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: false, mutate: false };
      
      const index = p.nodes.findIndex(n => n.id === nodeId);
      if (index === -1) return { result: false, mutate: false };
      
      p.nodes.splice(index, 1);
      // Clean up connected edges
      p.edges = p.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);
      
      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }

  async duplicateEntity(projectId: string, entityId: string, dx: number = 30, dy: number = 30): Promise<FlowNode | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const node = p.nodes.find(n => n.id === entityId);
      if (!node) return { result: null, mutate: false };

      const newNode: FlowNode = {
        ...node,
        id: generateId('n-'),
        x: node.x + dx,
        y: node.y + dy,
        fields: node.fields ? JSON.parse(JSON.stringify(node.fields)) : undefined
      };
      
      p.nodes.push(newNode);
      p.updatedAt = now();
      return { result: newNode, mutate: true };
    });
  }

  async alignEntities(projectId: string, entityIds: string[], alignment: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p || entityIds.length < 2) return { result: false, mutate: false };
      
      const targetNodes = p.nodes.filter(n => entityIds.includes(n.id));
      if (targetNodes.length < 2) return { result: false, mutate: false };

      const minX = Math.min(...targetNodes.map(n => n.x));
      const maxX = Math.max(...targetNodes.map(n => n.x + 160));
      const minY = Math.min(...targetNodes.map(n => n.y));
      const maxY = Math.max(...targetNodes.map(n => n.y + 80));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      targetNodes.forEach(node => {
        switch (alignment) {
          case 'left': node.x = minX; break;
          case 'center': node.x = centerX - 80; break;
          case 'right': node.x = maxX - 160; break;
          case 'top': node.y = minY; break;
          case 'middle': node.y = centerY - 40; break;
          case 'bottom': node.y = maxY - 80; break;
        }
      });

      if (alignment === 'distribute-h' && targetNodes.length > 2) {
        const sorted = [...targetNodes].sort((a, b) => a.x - b.x);
        const step = (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1);
        sorted.forEach((n, i) => n.x = sorted[0].x + step * i);
      } else if (alignment === 'distribute-v' && targetNodes.length > 2) {
        const sorted = [...targetNodes].sort((a, b) => a.y - b.y);
        const step = (sorted[sorted.length - 1].y - sorted[0].y) / (sorted.length - 1);
        sorted.forEach((n, i) => n.y = sorted[0].y + step * i);
      }

      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }

  async addEdge(projectId: string, edge: Partial<DataFlow>): Promise<DataFlow | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const newEdge: DataFlow = {
        id: edge.id || generateId('e-'),
        sourceId: edge.sourceId || '',
        sourcePort: edge.sourcePort || 'r',
        targetId: edge.targetId || '',
        targetPort: edge.targetPort || 'l',
        label: edge.label || '',
        dataMappings: edge.dataMappings,
        dir: edge.dir || 'fwd'
      };
      
      p.edges.push(newEdge);
      p.updatedAt = now();
      return { result: newEdge, mutate: true };
    });
  }

  async updateEdge(projectId: string, edgeId: string, updates: Partial<DataFlow>): Promise<DataFlow | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const edge = p.edges.find(e => e.id === edgeId);
      if (!edge) return { result: null, mutate: false };

      if (updates.label !== undefined) edge.label = updates.label;
      if (updates.dir !== undefined) edge.dir = updates.dir;
      
      p.updatedAt = now();
      return { result: edge, mutate: true };
    });
  }

  async deleteEdge(projectId: string, edgeId: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: false, mutate: false };
      
      const index = p.edges.findIndex(e => e.id === edgeId);
      if (index === -1) return { result: false, mutate: false };
      
      p.edges.splice(index, 1);
      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }

  async addRegion(projectId: string, region: Partial<Region>): Promise<Region | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const newRegion: Region = {
        id: generateId('r-'),
        title: region.title || '',
        x: region.x || 200,
        y: region.y || 200,
        w: region.w || 300,
        h: region.h || 300,
        color: region.color || '#f0f0f0',
        collapsed: region.collapsed || false
      };
      
      p.regions.push(newRegion);
      p.updatedAt = now();
      return { result: newRegion, mutate: true };
    });
  }

  async updateRegion(projectId: string, regionId: string, updates: Partial<Region>): Promise<Region | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const region = p.regions.find(r => r.id === regionId);
      if (!region) return { result: null, mutate: false };

      if (updates.title !== undefined) region.title = updates.title;
      if (updates.x !== undefined) region.x = updates.x;
      if (updates.y !== undefined) region.y = updates.y;
      if (updates.w !== undefined) region.w = updates.w;
      if (updates.h !== undefined) region.h = updates.h;
      if (updates.color !== undefined) region.color = updates.color;
      if (updates.collapsed !== undefined) region.collapsed = updates.collapsed;
      
      p.updatedAt = now();
      return { result: region, mutate: true };
    });
  }

  async deleteRegion(projectId: string, regionId: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: false, mutate: false };
      
      const index = p.regions.findIndex(r => r.id === regionId);
      if (index === -1) return { result: false, mutate: false };
      
      p.regions.splice(index, 1);
      // Unlink nodes
      for (const node of p.nodes) {
        if (node.regionId === regionId) {
          node.regionId = undefined;
        }
      }
      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }

  // --- Requirements ---
  async addRequirement(projectId: string, req: Partial<Requirement>): Promise<Requirement | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const newReq: Requirement = {
        id: generateId('req-'),
        title: req.title || 'New Requirement',
        description: req.description || '',
        type: req.type || 'feature',
        priority: req.priority || 'medium',
        status: req.status || 'not_started',
        criteria: req.criteria || [],
        scope: req.scope || [],
        expression: req.expression || '',
        category: req.category || '',
        nodeIds: req.nodeIds || [],
        edgeIds: req.edgeIds || [],
        regionIds: req.regionIds || []
      };
      
      p.requirements = p.requirements || [];
      p.requirements.push(newReq);
      p.updatedAt = now();
      return { result: newReq, mutate: true };
    });
  }

  async updateRequirement(projectId: string, reqId: string, updates: Partial<Requirement>): Promise<Requirement | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p || !p.requirements) return { result: null, mutate: false };
      
      const req = p.requirements.find(r => r.id === reqId);
      if (!req) return { result: null, mutate: false };
      
      if (updates.title !== undefined) req.title = updates.title;
      if (updates.description !== undefined) req.description = updates.description;
      if (updates.type !== undefined) req.type = updates.type;
      if (updates.priority !== undefined) req.priority = updates.priority;
      if (updates.status !== undefined) req.status = updates.status;
      if (updates.criteria !== undefined) req.criteria = updates.criteria;
      if (updates.scope !== undefined) req.scope = updates.scope;
      if (updates.expression !== undefined) req.expression = updates.expression;
      if (updates.category !== undefined) req.category = updates.category;
      if (updates.nodeIds !== undefined) req.nodeIds = updates.nodeIds;
      if (updates.edgeIds !== undefined) req.edgeIds = updates.edgeIds;
      if (updates.regionIds !== undefined) req.regionIds = updates.regionIds;
      
      p.updatedAt = now();
      return { result: req, mutate: true };
    });
  }

  async deleteRequirement(projectId: string, reqId: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p || !p.requirements) return { result: false, mutate: false };
      
      const index = p.requirements.findIndex(r => r.id === reqId);
      if (index === -1) return { result: false, mutate: false };
      
      p.requirements.splice(index, 1);
      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }

  async addBusinessFlow(projectId: string, flow: Partial<BusinessFlow>): Promise<BusinessFlow | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const newFlow: BusinessFlow = {
        id: generateId('flow-'),
        name: flow.name || '',
        description: flow.description || '',
        nodeIds: flow.nodeIds || [],
        edgeIds: flow.edgeIds || []
      };
      
      if (!p.businessFlows) p.businessFlows = [];
      p.businessFlows.push(newFlow);
      p.updatedAt = now();
      return { result: newFlow, mutate: true };
    });
  }

  async updateBusinessFlow(projectId: string, flowId: string, updates: Partial<BusinessFlow>): Promise<BusinessFlow | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      if (!p.businessFlows) p.businessFlows = [];
      const flow = p.businessFlows.find(f => f.id === flowId);
      if (!flow) return { result: null, mutate: false };

      if (updates.name !== undefined) flow.name = updates.name;
      if (updates.description !== undefined) flow.description = updates.description;
      if (updates.nodeIds !== undefined) flow.nodeIds = updates.nodeIds;
      if (updates.edgeIds !== undefined) flow.edgeIds = updates.edgeIds;
      
      p.updatedAt = now();
      return { result: flow, mutate: true };
    });
  }

  async deleteBusinessFlow(projectId: string, flowId: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: false, mutate: false };
      
      if (!p.businessFlows) return { result: false, mutate: false };
      const index = p.businessFlows.findIndex(f => f.id === flowId);
      if (index === -1) return { result: false, mutate: false };
      
      p.businessFlows.splice(index, 1);
      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }

  async searchProject(projectId: string, query: string): Promise<Partial<Project> | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };
      
      const lowerQuery = query.toLowerCase();
      
      const matchedNodes = p.nodes.filter(n => 
        n.label.toLowerCase().includes(lowerQuery) || 
        (n.sublabel && n.sublabel.toLowerCase().includes(lowerQuery)) ||
        (n.fields && n.fields.some(f => f.name.toLowerCase().includes(lowerQuery)))
      );
      
      const matchedEdges = p.edges.filter(e => 
        e.label.toLowerCase().includes(lowerQuery)
      );

      const matchedRegions = p.regions.filter(r => 
        r.title.toLowerCase().includes(lowerQuery)
      );

      return {
        result: {
          id: p.id,
          name: p.name,
          nodes: matchedNodes,
          edges: matchedEdges,
          regions: matchedRegions
        },
        mutate: false
      };
    });
  }

  async validateProject(projectId: string): Promise<ProjectValidationResult | null> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: null, mutate: false };

      const issues: ProjectValidationIssue[] = [];
      const nodeIds = new Set(p.nodes.map(n => n.id));
      const edgeIds = new Set(p.edges.map(e => e.id));
      const regionIds = new Set(p.regions.map(r => r.id));
      const connectedNodeIds = new Set<string>();

      const addIssue = (
        severity: ProjectValidationIssue['severity'],
        code: string,
        message: string,
        refs: Omit<ProjectValidationIssue, 'severity' | 'code' | 'message'> = {}
      ) => {
        issues.push({ severity, code, message, ...refs });
      };

      const addDuplicateIssues = (
        values: string[],
        code: string,
        label: string
      ) => {
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        for (const value of values) {
          if (seen.has(value)) duplicates.add(value);
          seen.add(value);
        }
        for (const value of duplicates) {
          addIssue('error', code, `${label} has duplicate id: ${value}`);
        }
      };

      const getNode = (nodeId: string) => p.nodes.find(n => n.id === nodeId);
      const getField = (nodeId: string, fieldName: string): Field | undefined => {
        const node = getNode(nodeId);
        return node?.fields?.find(f => f.name === fieldName);
      };

      addDuplicateIssues(p.nodes.map(n => n.id), 'duplicate_node_id', 'Project node list');
      addDuplicateIssues(p.edges.map(e => e.id), 'duplicate_edge_id', 'Project edge list');
      addDuplicateIssues(p.regions.map(r => r.id), 'duplicate_region_id', 'Project region list');

      for (const node of p.nodes) {
        if (node.regionId && !regionIds.has(node.regionId)) {
          addIssue(
            'warning',
            'missing_region_reference',
            `Node "${node.label}" references missing region ${node.regionId}.`,
            { nodeId: node.id, regionId: node.regionId }
          );
        }

        const fieldNames = new Set<string>();
        const duplicatedFieldNames = new Set<string>();
        for (const field of node.fields || []) {
          const fieldName = field.name?.trim();
          if (!fieldName) {
            addIssue('warning', 'empty_field_name', `Node "${node.label}" has an empty field name.`, {
              nodeId: node.id,
            });
            continue;
          }

          if (fieldNames.has(fieldName)) duplicatedFieldNames.add(fieldName);
          fieldNames.add(fieldName);

          if (field.keyRole === 'foreign' && !field.ref) {
            addIssue(
              'warning',
              'foreign_key_without_ref',
              `Field "${node.label}.${field.name}" is marked FK but has no explicit ref.`,
              { nodeId: node.id, fieldName: field.name }
            );
          }

          if (field.ref) {
            const separatorIndex = field.ref.indexOf('.');
            const refNodeId = separatorIndex >= 0 ? field.ref.slice(0, separatorIndex) : '';
            const refFieldName = separatorIndex >= 0 ? field.ref.slice(separatorIndex + 1) : '';

            if (!refNodeId || !refFieldName) {
              addIssue(
                'error',
                'invalid_field_ref_format',
                `Field "${node.label}.${field.name}" has invalid ref "${field.ref}". Expected entityId.fieldName.`,
                { nodeId: node.id, fieldName: field.name }
              );
            } else if (!nodeIds.has(refNodeId)) {
              addIssue(
                'error',
                'missing_ref_entity',
                `Field "${node.label}.${field.name}" references missing entity ${refNodeId}.`,
                { nodeId: node.id, fieldName: field.name }
              );
            } else if (!getField(refNodeId, refFieldName)) {
              addIssue(
                'error',
                'missing_ref_field',
                `Field "${node.label}.${field.name}" references missing field ${field.ref}.`,
                { nodeId: node.id, fieldName: field.name }
              );
            }

            if (field.keyRole && field.keyRole !== 'foreign') {
              addIssue(
                'warning',
                'ref_on_non_foreign_key',
                `Field "${node.label}.${field.name}" has ref but keyRole is "${field.keyRole}".`,
                { nodeId: node.id, fieldName: field.name }
              );
            } else if (!field.keyRole) {
              addIssue(
                'info',
                'ref_without_key_role',
                `Field "${node.label}.${field.name}" has explicit ref but no keyRole.`,
                { nodeId: node.id, fieldName: field.name }
              );
            }
          }
        }

        for (const fieldName of duplicatedFieldNames) {
          addIssue(
            'warning',
            'duplicate_field_name',
            `Node "${node.label}" has duplicate field "${fieldName}".`,
            { nodeId: node.id, fieldName }
          );
        }

        const hasPrimaryKey = (node.fields || []).some(field => field.keyRole === 'primary');
        if (node.type === 'entity' && (node.fields || []).length > 0 && !hasPrimaryKey) {
          addIssue('info', 'entity_without_primary_key', `Entity "${node.label}" has fields but no explicit PK.`, {
            nodeId: node.id,
          });
        }
      }

      for (const edge of p.edges) {
        if (!nodeIds.has(edge.sourceId)) {
          addIssue('error', 'missing_edge_source', `Edge "${edge.label || edge.id}" source node is missing.`, {
            edgeId: edge.id,
            nodeId: edge.sourceId,
          });
        } else {
          connectedNodeIds.add(edge.sourceId);
        }

        if (!nodeIds.has(edge.targetId)) {
          addIssue('error', 'missing_edge_target', `Edge "${edge.label || edge.id}" target node is missing.`, {
            edgeId: edge.id,
            nodeId: edge.targetId,
          });
        } else {
          connectedNodeIds.add(edge.targetId);
        }
      }

      for (const req of p.requirements || []) {
        for (const nodeId of req.nodeIds || []) {
          if (!nodeIds.has(nodeId)) {
            addIssue('warning', 'requirement_missing_node', `Requirement "${req.title}" references missing node ${nodeId}.`, {
              requirementId: req.id,
              nodeId,
            });
          } else {
            connectedNodeIds.add(nodeId);
          }
        }
        for (const edgeId of req.edgeIds || []) {
          if (!edgeIds.has(edgeId)) {
            addIssue('warning', 'requirement_missing_edge', `Requirement "${req.title}" references missing edge ${edgeId}.`, {
              requirementId: req.id,
              edgeId,
            });
          }
        }
        for (const regionId of req.regionIds || []) {
          if (!regionIds.has(regionId)) {
            addIssue('warning', 'requirement_missing_region', `Requirement "${req.title}" references missing region ${regionId}.`, {
              requirementId: req.id,
              regionId,
            });
          }
        }
      }

      for (const flow of p.businessFlows || []) {
        for (const nodeId of flow.nodeIds || []) {
          if (!nodeIds.has(nodeId)) {
            addIssue('warning', 'business_flow_missing_node', `Business flow "${flow.name}" references missing node ${nodeId}.`, {
              businessFlowId: flow.id,
              nodeId,
            });
          } else {
            connectedNodeIds.add(nodeId);
          }
        }
        for (const edgeId of flow.edgeIds || []) {
          if (!edgeIds.has(edgeId)) {
            addIssue('warning', 'business_flow_missing_edge', `Business flow "${flow.name}" references missing edge ${edgeId}.`, {
              businessFlowId: flow.id,
              edgeId,
            });
          }
        }
      }

      for (const node of p.nodes) {
        if (!connectedNodeIds.has(node.id)) {
          addIssue('info', 'isolated_node', `Node "${node.label}" is not connected to any edge, requirement, or business flow.`, {
            nodeId: node.id,
          });
        }
      }

      const errors = issues.filter(issue => issue.severity === 'error').length;
      const warnings = issues.filter(issue => issue.severity === 'warning').length;
      const infos = issues.filter(issue => issue.severity === 'info').length;

      return {
        result: {
          projectId: p.id,
          name: p.name,
          summary: {
            errors,
            warnings,
            infos,
            total: issues.length,
          },
          issues,
        },
        mutate: false,
      };
    });
  }

  async formatCanvas(projectId: string): Promise<boolean> {
    return this.withLock(projects => {
      const p = projects.find(p => p.id === projectId);
      if (!p) return { result: false, mutate: false };

      const g = new dagre.graphlib.Graph({ compound: true });
      g.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 80, ranksep: 150, edgesep: 40 });
      g.setDefaultEdgeLabel(() => ({}));

      p.regions.forEach(r => {
        g.setNode(r.id, {});
      });

      p.nodes.forEach(n => {
        const fieldCount = n.fields ? n.fields.length : 0;
        const actualHeight = 60 + fieldCount * 22;
        g.setNode(n.id, { width: 180 + 40, height: actualHeight + 40 });
        if (n.regionId) {
          g.setParent(n.id, n.regionId);
        }
      });

      p.edges.forEach(e => {
        g.setEdge(e.sourceId, e.targetId);
      });

      dagre.layout(g);

      p.nodes.forEach(n => {
        const dn = g.node(n.id);
        if (dn) {
          const fieldCount = n.fields ? n.fields.length : 0;
          const actualHeight = 60 + fieldCount * 22;
          n.x = dn.x - 90;
          n.y = dn.y - actualHeight / 2;
        }
      });

      p.regions.forEach(r => {
        const dr = g.node(r.id);
        if (dr) {
          r.x = dr.x - dr.width / 2 + 10;
          r.y = dr.y - dr.height / 2 - 20;
          r.w = Math.max(dr.width - 20, 200);
          r.h = Math.max(dr.height + 20, 160);
        }
      });

      p.updatedAt = now();
      return { result: true, mutate: true };
    });
  }
}
