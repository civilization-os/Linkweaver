import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import lockfile from 'proper-lockfile';
import crypto from 'crypto';
import dagre from 'dagre';
function generateId(prefix) {
    return prefix + crypto.randomBytes(4).toString('hex');
}
function now() {
    return Date.now();
}
export class Store {
    dataDir;
    filePath;
    constructor(dataDir) {
        this.dataDir = dataDir || path.join(os.homedir(), '.reqflow');
        this.filePath = path.join(this.dataDir, 'projects.json');
    }
    async init() {
        await fs.mkdir(this.dataDir, { recursive: true });
        try {
            await fs.access(this.filePath);
        }
        catch {
            await fs.writeFile(this.filePath, '[]', 'utf8');
        }
    }
    async withLock(action) {
        const release = await lockfile.lock(this.filePath, { retries: { retries: 5, minTimeout: 100 } });
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            const projects = JSON.parse(data);
            const { result, mutate } = await action(projects);
            if (mutate) {
                await fs.writeFile(this.filePath, JSON.stringify(projects, null, 2), 'utf8');
            }
            return result;
        }
        finally {
            await release();
        }
    }
    async listProjects() {
        const data = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(data);
    }
    async getProject(id) {
        const projects = await this.listProjects();
        return projects.find(p => p.id === id);
    }
    async createProject(name) {
        return this.withLock(projects => {
            const p = {
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
    async deleteProject(id) {
        return this.withLock(projects => {
            const index = projects.findIndex(p => p.id === id);
            if (index === -1)
                return { result: false, mutate: false };
            projects.splice(index, 1);
            return { result: true, mutate: true };
        });
    }
    async updateProject(id, updates) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === id);
            if (!p)
                return { result: null, mutate: false };
            if (updates.name !== undefined)
                p.name = updates.name;
            if (updates.version !== undefined)
                p.version = updates.version;
            if (updates.description !== undefined)
                p.description = updates.description;
            p.updatedAt = now();
            return { result: p, mutate: true };
        });
    }
    async addNode(projectId, node) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const newNode = {
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
    async updateNode(projectId, nodeId, updates) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const node = p.nodes.find(n => n.id === nodeId);
            if (!node)
                return { result: null, mutate: false };
            if (updates.label !== undefined)
                node.label = updates.label;
            if (updates.type !== undefined)
                node.type = updates.type;
            if (updates.x !== undefined)
                node.x = updates.x;
            if (updates.y !== undefined)
                node.y = updates.y;
            if (updates.regionId !== undefined)
                node.regionId = updates.regionId;
            if (updates.fields !== undefined)
                node.fields = updates.fields;
            p.updatedAt = now();
            return { result: node, mutate: true };
        });
    }
    async deleteNode(projectId, nodeId) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: false, mutate: false };
            const index = p.nodes.findIndex(n => n.id === nodeId);
            if (index === -1)
                return { result: false, mutate: false };
            p.nodes.splice(index, 1);
            p.edges = p.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);
            p.updatedAt = now();
            return { result: true, mutate: true };
        });
    }
    async addEdge(projectId, edge) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const newEdge = {
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
    async updateEdge(projectId, edgeId, updates) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const edge = p.edges.find(e => e.id === edgeId);
            if (!edge)
                return { result: null, mutate: false };
            if (updates.label !== undefined)
                edge.label = updates.label;
            if (updates.dir !== undefined)
                edge.dir = updates.dir;
            p.updatedAt = now();
            return { result: edge, mutate: true };
        });
    }
    async deleteEdge(projectId, edgeId) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: false, mutate: false };
            const index = p.edges.findIndex(e => e.id === edgeId);
            if (index === -1)
                return { result: false, mutate: false };
            p.edges.splice(index, 1);
            p.updatedAt = now();
            return { result: true, mutate: true };
        });
    }
    async addRegion(projectId, region) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const newRegion = {
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
    async updateRegion(projectId, regionId, updates) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const region = p.regions.find(r => r.id === regionId);
            if (!region)
                return { result: null, mutate: false };
            if (updates.title !== undefined)
                region.title = updates.title;
            if (updates.x !== undefined)
                region.x = updates.x;
            if (updates.y !== undefined)
                region.y = updates.y;
            if (updates.w !== undefined)
                region.w = updates.w;
            if (updates.h !== undefined)
                region.h = updates.h;
            if (updates.color !== undefined)
                region.color = updates.color;
            if (updates.collapsed !== undefined)
                region.collapsed = updates.collapsed;
            p.updatedAt = now();
            return { result: region, mutate: true };
        });
    }
    async deleteRegion(projectId, regionId) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: false, mutate: false };
            const index = p.regions.findIndex(r => r.id === regionId);
            if (index === -1)
                return { result: false, mutate: false };
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
    async addBusinessFlow(projectId, flow) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const newFlow = {
                id: generateId('flow-'),
                name: flow.name || '',
                description: flow.description || '',
                nodeIds: flow.nodeIds || [],
                edgeIds: flow.edgeIds || []
            };
            if (!p.businessFlows)
                p.businessFlows = [];
            p.businessFlows.push(newFlow);
            p.updatedAt = now();
            return { result: newFlow, mutate: true };
        });
    }
    async updateBusinessFlow(projectId, flowId, updates) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            if (!p.businessFlows)
                p.businessFlows = [];
            const flow = p.businessFlows.find(f => f.id === flowId);
            if (!flow)
                return { result: null, mutate: false };
            if (updates.name !== undefined)
                flow.name = updates.name;
            if (updates.description !== undefined)
                flow.description = updates.description;
            if (updates.nodeIds !== undefined)
                flow.nodeIds = updates.nodeIds;
            if (updates.edgeIds !== undefined)
                flow.edgeIds = updates.edgeIds;
            p.updatedAt = now();
            return { result: flow, mutate: true };
        });
    }
    async deleteBusinessFlow(projectId, flowId) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: false, mutate: false };
            if (!p.businessFlows)
                return { result: false, mutate: false };
            const index = p.businessFlows.findIndex(f => f.id === flowId);
            if (index === -1)
                return { result: false, mutate: false };
            p.businessFlows.splice(index, 1);
            p.updatedAt = now();
            return { result: true, mutate: true };
        });
    }
    async searchProject(projectId, query) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: null, mutate: false };
            const lowerQuery = query.toLowerCase();
            const matchedNodes = p.nodes.filter(n => n.label.toLowerCase().includes(lowerQuery) ||
                (n.sublabel && n.sublabel.toLowerCase().includes(lowerQuery)) ||
                (n.fields && n.fields.some(f => f.name.toLowerCase().includes(lowerQuery))));
            const matchedEdges = p.edges.filter(e => e.label.toLowerCase().includes(lowerQuery));
            const matchedRegions = p.regions.filter(r => r.title.toLowerCase().includes(lowerQuery));
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
    async formatCanvas(projectId) {
        return this.withLock(projects => {
            const p = projects.find(p => p.id === projectId);
            if (!p)
                return { result: false, mutate: false };
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
