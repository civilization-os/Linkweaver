import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema, 
  ErrorCode, 
  ListToolsRequestSchema, 
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
import { Store } from './store.js';

const FIELD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Field name' },
    type: { type: 'string', description: 'string|int|float|bool|datetime|bytes|ref|array|map|struct|enum|union' },
    primitiveType: { type: 'string', description: 'Optional logical primitive type' },
    keyRole: {
      type: 'string',
      enum: ['primary', 'foreign', 'unique'],
      description: 'Explicit field semantic role: primary=PK, foreign=FK, unique=UK. Do not infer from field names such as id, user_id, *_id, or same-name fields.'
    },
    ref: {
      type: 'string',
      description: 'Explicit referenced target for relationship fields, formatted as entityId.fieldName. Only set when the user/spec confirms the relationship.'
    },
    required: { type: 'boolean' },
    default: { type: 'string' },
    description: { type: 'string' }
  },
  required: ['name', 'type']
};

export function setupMcp(server: Server, store: Store) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_projects',
          description: 'List all projects',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'query_project',
          description: 'Get project structure and metadata',
          inputSchema: {
            type: 'object',
            properties: { 
              project_id: { type: 'string' },
              summary: { type: 'boolean', description: 'If true, returns a human-readable text summary instead of full JSON. Default is false.' }
            },
            required: ['project_id']
          }
        },
        {
          name: 'get_project',
          description: 'Get full project structure by ID (alias of query_project without summary)',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' }
            },
            required: ['project_id']
          }
        },
        {
          name: 'create_project',
          description: 'Create a new project',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name']
          }
        },
        {
          name: 'update_project',
          description: 'Update project properties (name, version)',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              name: { type: 'string' },
              version: { type: 'string' }
            },
            required: ['project_id']
          }
        },
        {
          name: 'delete_project',
          description: 'Delete a project',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'list_entities',
          description: 'List all entities in a project',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'get_entity',
          description: 'Get a specific entity by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              entity_id: { type: 'string' }
            },
            required: ['project_id', 'entity_id']
          }
        },
        {
          name: 'create_entity',
          description: 'Create a new data entity in a project. Field key semantics must be explicit: use keyRole for PK/FK/UK and ref for confirmed relationships. Never mark a field as a key only because its name is id, *_id, or matches another field name.',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string', description: 'entity|actor|process|nested' },
              fields: { type: 'array', items: FIELD_SCHEMA, description: 'Fields array. Each key role and relationship reference must be explicitly supplied, not inferred.' },
              fields_json: { type: 'string', description: 'JSON string of fields using the same schema as fields.' },
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' },
              regionId: { type: 'string', description: 'Optional region ID' }
            },
            required: ['project_id', 'name']
          }
        },
        {
          name: 'update_entity',
          description: 'Update a data entity in a project. Field key semantics must be explicit: use keyRole for PK/FK/UK and ref for confirmed relationships. Never mark a field as a key only because its name is id, *_id, or matches another field name.',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              entity_id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string', description: 'entity|actor|process|nested' },
              fields: { type: 'array', items: FIELD_SCHEMA, description: 'Fields array. Each key role and relationship reference must be explicitly supplied, not inferred.' },
              fields_json: { type: 'string', description: 'JSON string of fields using the same schema as fields.' },
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' },
              regionId: { type: 'string', description: 'Optional region ID' }
            },
            required: ['project_id', 'entity_id']
          }
        },
        {
          name: 'delete_entity',
          description: 'Delete an entity by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              entity_id: { type: 'string' }
            },
            required: ['project_id', 'entity_id']
          }
        },
        {
          name: 'duplicate_entity',
          description: 'Duplicate an entity by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              entity_id: { type: 'string' },
              dx: { type: 'number', description: 'Offset X (default 30)' },
              dy: { type: 'number', description: 'Offset Y (default 30)' }
            },
            required: ['project_id', 'entity_id']
          }
        },
        {
          name: 'align_entities',
          description: 'Align multiple entities',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              entity_ids: { type: 'array', items: { type: 'string' } },
              alignment: { type: 'string', description: 'left|center|right|top|middle|bottom|distribute-h|distribute-v' }
            },
            required: ['project_id', 'entity_ids', 'alignment']
          }
        },
        {
          name: 'list_flows',
          description: 'List all data flows in a project',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'get_flow',
          description: 'Get a specific data flow by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },
        {
          name: 'create_flow',
          description: 'Create a data flow between two entities',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              source_id: { type: 'string' },
              target_id: { type: 'string' },
              label: { type: 'string' },
              dir: { type: 'string', description: 'fwd|rev|both' }
            },
            required: ['project_id', 'source_id', 'target_id']
          }
        },
        {
          name: 'delete_edge',
          description: 'Delete a data flow/edge by its id (alias of delete_flow)',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },
        {
          name: 'update_edge',
          description: 'Update a data flow/edge properties (label, dir) (alias of update_flow)',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' },
              label: { type: 'string' },
              dir: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },
        {
          name: 'delete_flow',
          description: 'Delete a data flow by its id',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },
        {
          name: 'update_flow',
          description: 'Update a data flow properties (label, dir)',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' },
              label: { type: 'string' },
              dir: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },
        {
          name: 'list_regions',
          description: 'List all regions in a project',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'get_region',
          description: 'Get a specific region by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              region_id: { type: 'string' }
            },
            required: ['project_id', 'region_id']
          }
        },
        {
          name: 'create_region',
          description: 'Create a service region in a project',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              title: { type: 'string' },
              x: { type: 'number' },
              y: { type: 'number' },
              w: { type: 'number' },
              h: { type: 'number' },
              color: { type: 'string' }
            },
            required: ['project_id', 'title']
          }
        },
        {
          name: 'update_region',
          description: 'Update a service region in a project',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              region_id: { type: 'string' },
              title: { type: 'string' },
              color: { type: 'string' }
            },
            required: ['project_id', 'region_id']
          }
        },
        {
          name: 'delete_region',
          description: 'Delete a region by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              region_id: { type: 'string' }
            },
            required: ['project_id', 'region_id']
          }
        },
        {
          name: 'list_requirements',
          description: 'List all requirements in a project',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'get_requirement',
          description: 'Get a specific requirement by ID',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              req_id: { type: 'string' }
            },
            required: ['project_id', 'req_id']
          }
        },
        {
          name: 'create_requirement',
          description: 'Create a requirement. Use description for markdown (images, videos, rich text). Status should be one of: not_started, in_progress, completed',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string' },
              nodeIds: { type: 'array', items: { type: 'string' } },
              edgeIds: { type: 'array', items: { type: 'string' } },
              regionIds: { type: 'array', items: { type: 'string' } }
            },
            required: ['project_id', 'title']
          }
        },
        {
          name: 'update_requirement',
          description: 'Update a requirement',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              req_id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string' },
              nodeIds: { type: 'array', items: { type: 'string' } },
              edgeIds: { type: 'array', items: { type: 'string' } },
              regionIds: { type: 'array', items: { type: 'string' } }
            },
            required: ['project_id', 'req_id']
          }
        },
        {
          name: 'delete_requirement',
          description: 'Delete a requirement',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              req_id: { type: 'string' }
            },
            required: ['project_id', 'req_id']
          }
        },
        {
          name: 'list_business_flows',
          description: 'List all business flows in a project',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'create_business_flow',
          description: 'Create a business flow. Optionally pass node_ids_json and edge_ids_json to create a complete flow from confirmed node/edge IDs.',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              node_ids_json: { type: 'string', description: 'JSON string array of node IDs included in this business flow' },
              edge_ids_json: { type: 'string', description: 'JSON string array of edge/flow IDs included in this business flow' }
            },
            required: ['project_id', 'name']
          }
        },
        {
          name: 'update_business_flow',
          description: 'Update a business flow properties, nodes, or edges',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              node_ids_json: { type: 'string' },
              edge_ids_json: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },
        {
          name: 'delete_business_flow',
          description: 'Delete a business flow',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              flow_id: { type: 'string' }
            },
            required: ['project_id', 'flow_id']
          }
        },

        {
          name: 'format_canvas',
          description: 'Format the layout of nodes and regions automatically using dagre',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'validate_project',
          description: 'Read-only project health check. Validates broken references, invalid field refs, explicit PK/FK/UK metadata, requirements, business flows, and isolated nodes without modifying the project.',
          inputSchema: {
            type: 'object',
            properties: { project_id: { type: 'string' } },
            required: ['project_id']
          }
        },
        {
          name: 'search',
          description: 'Search for entities, regions, and data flows by text query',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string' },
              query: { type: 'string' }
            },
            required: ['project_id', 'query']
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const name = request.params.name;
      const args = request.params.arguments || {};

      switch (name) {
        case 'list_projects': {
          const projects = await store.listProjects();
          const summaries = projects.map(p => ({
            id: p.id,
            name: p.name,
            version: p.version,
            description: p.description,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            nodeCount: p.nodes?.length || 0,
            edgeCount: p.edges?.length || 0,
            regionCount: p.regions?.length || 0,
            flowCount: p.businessFlows?.length || 0
          }));
          return { content: [{ type: 'text', text: JSON.stringify(summaries, null, 2) }] };
        }
        case 'get_project': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(p, null, 2) }] };
        }
        case 'create_project': {
          const p = await store.createProject(args.name as string);
          return { content: [{ type: 'text', text: `Project created:\n${JSON.stringify(p, null, 2)}` }] };
        }
        case 'update_project': {
          const { project_id, name, version } = args as any;
          if (!project_id) throw new McpError(ErrorCode.InvalidParams, 'Missing project_id');
          const p = await store.updateProject(project_id, { name, version });
          if (!p) throw new McpError(ErrorCode.InternalError, 'Project not found');
          return { content: [{ type: 'text', text: JSON.stringify(p, null, 2) }] };
        }
        case 'delete_project': {
          const ok = await store.deleteProject(args.project_id as string);
          return { content: [{ type: 'text', text: ok ? `Project deleted` : `Project not found` }] };
        }
        case 'list_entities': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(p.nodes, null, 2) }] };
        }
        case 'get_entity': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          const entity = p.nodes.find(n => n.id === args.entity_id);
          if (!entity) return { content: [{ type: 'text', text: 'Entity not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] };
        }
        case 'create_entity': {
          let fields = (args.fields as any[]) || [];
          if (args.fields_json) {
            try { fields = JSON.parse(args.fields_json as string); } catch (e) {}
          }
          const labelMap: Record<string, string> = { entity: '实体', actor: '外部', process: '流程', nested: '嵌套' };
          const type = (args.type as string) || 'entity';
          const node = await store.addNode(args.project_id as string, {
            type,
            label: args.name as string,
            sublabel: labelMap[type],
            fields,
            x: (args.x as number) ?? 300, 
            y: (args.y as number) ?? 300,
            regionId: (args.regionId as string) || undefined
          });
          if (!node) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: `Entity created:\n${JSON.stringify(node, null, 2)}` }] };
        }
        case 'update_entity': {
          let fields = args.fields as any[] | undefined;
          if (args.fields_json) {
            try { fields = JSON.parse(args.fields_json as string); } catch (e) {}
          }
          const updates: any = {};
          if (args.name) updates.label = args.name;
          if (args.type) updates.type = args.type;
          if (fields !== undefined) updates.fields = fields;
          if (args.x !== undefined) updates.x = args.x;
          if (args.y !== undefined) updates.y = args.y;
          if (args.regionId !== undefined) updates.regionId = args.regionId;
          const node = await store.updateNode(args.project_id as string, args.entity_id as string, updates);
          if (!node) return { content: [{ type: 'text', text: 'Entity not found' }] };
          return { content: [{ type: 'text', text: `Entity updated:\n${JSON.stringify(node, null, 2)}` }] };
        }
        case 'delete_entity': {
          const ok = await store.deleteNode(args.project_id as string, args.entity_id as string);
          return { content: [{ type: 'text', text: ok ? `Entity deleted` : `Entity not found` }] };
        }
        case 'duplicate_entity': {
          const { project_id, entity_id, dx = 30, dy = 30 } = args as any;
          const node = await store.duplicateEntity(project_id, entity_id, dx, dy);
          return { content: [{ type: 'text', text: node ? `Entity duplicated:\n${JSON.stringify(node, null, 2)}` : 'Entity not found' }] };
        }
        case 'align_entities': {
          const { project_id, entity_ids, alignment } = args as any;
          const ok = await store.alignEntities(project_id, entity_ids, alignment);
          return { content: [{ type: 'text', text: ok ? `Entities aligned` : `Failed to align entities` }] };
        }
        case 'list_flows': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(p.edges, null, 2) }] };
        }
        case 'get_flow': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          const flow = p.edges.find(e => e.id === args.flow_id);
          if (!flow) return { content: [{ type: 'text', text: 'Flow not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(flow, null, 2) }] };
        }
        case 'create_flow': {
          const sourceId = args.source_id as string;
          const targetId = args.target_id as string;
          const label = (args.label as string) || `${sourceId.slice(0, 6)} → ${targetId.slice(0, 6)}`;
          const edge = await store.addEdge(args.project_id as string, {
            sourceId, targetId, sourcePort: 'r', targetPort: 'l', label, dir: (args.dir as string) || 'fwd'
          });
          if (!edge) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: `Flow created:\n${JSON.stringify(edge, null, 2)}` }] };
        }
        case 'delete_edge':
        case 'delete_flow': {
          const { project_id, flow_id } = args as any;
          if (!project_id || !flow_id) throw new McpError(ErrorCode.InvalidParams, 'Missing project_id or flow_id');
          const ok = await store.deleteEdge(project_id, flow_id);
          return { content: [{ type: 'text', text: ok ? `Flow deleted` : `Flow not found` }] };
        }
        case 'update_edge':
        case 'update_flow': {
          const { project_id, flow_id, label, dir } = args as any;
          if (!project_id || !flow_id) throw new McpError(ErrorCode.InvalidParams, 'Missing project_id or flow_id');
          const result = await store.updateEdge(project_id, flow_id, { label, dir });
          if (!result) throw new McpError(ErrorCode.InternalError, 'Project or edge not found');
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'list_regions': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(p.regions, null, 2) }] };
        }
        case 'get_region': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          const region = p.regions.find(r => r.id === args.region_id);
          if (!region) return { content: [{ type: 'text', text: 'Region not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(region, null, 2) }] };
        }
        case 'create_region': {
          const region = await store.addRegion(args.project_id as string, {
            title: args.title as string, 
            x: (args.x as number) ?? 200, 
            y: (args.y as number) ?? 200, 
            w: (args.w as number) ?? 300, 
            h: (args.h as number) ?? 300, 
            color: (args.color as string) || '#f4f4f5'
          });
          if (!region) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: `Region created:\n${JSON.stringify(region, null, 2)}` }] };
        }
        case 'update_region': {
          const updates: any = {};
          if (args.title) updates.title = args.title;
          if (args.color) updates.color = args.color;
          const region = await store.updateRegion(args.project_id as string, args.region_id as string, updates);
          if (!region) return { content: [{ type: 'text', text: 'Region not found' }] };
          return { content: [{ type: 'text', text: `Region updated:\n${JSON.stringify(region, null, 2)}` }] };
        }
        case 'delete_region': {
          const success = await store.deleteRegion(args.project_id as string, args.region_id as string);
          return { content: [{ type: 'text', text: success ? `Region deleted` : `Region not found` }] };
        }
        case 'list_requirements': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(p.requirements || [], null, 2) }] };
        }
        case 'get_requirement': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          const req = (p.requirements || []).find(r => r.id === args.req_id);
          if (!req) return { content: [{ type: 'text', text: 'Requirement not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(req, null, 2) }] };
        }
        case 'create_requirement': {
          const r = await store.addRequirement(args.project_id as string, {
            title: args.title as string,
            description: args.description as string,
            status: args.status as string,
            priority: args.priority as string,
            nodeIds: args.nodeIds as string[],
            edgeIds: args.edgeIds as string[],
            regionIds: args.regionIds as string[]
          });
          if (!r) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: `Requirement created:\n${JSON.stringify(r, null, 2)}` }] };
        }
        case 'update_requirement': {
          const updates: any = {};
          if (args.title) updates.title = args.title;
          if (args.description) updates.description = args.description;
          if (args.status) updates.status = args.status;
          if (args.priority) updates.priority = args.priority;
          if (args.nodeIds) updates.nodeIds = args.nodeIds;
          if (args.edgeIds) updates.edgeIds = args.edgeIds;
          if (args.regionIds) updates.regionIds = args.regionIds;
          const r = await store.updateRequirement(args.project_id as string, args.req_id as string, updates);
          if (!r) return { content: [{ type: 'text', text: 'Requirement not found' }] };
          return { content: [{ type: 'text', text: `Requirement updated:\n${JSON.stringify(r, null, 2)}` }] };
        }
        case 'delete_requirement': {
          const ok = await store.deleteRequirement(args.project_id as string, args.req_id as string);
          return { content: [{ type: 'text', text: ok ? `Requirement deleted` : `Requirement not found` }] };
        }
        case 'list_business_flows': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: JSON.stringify(p.businessFlows, null, 2) }] };
        }
        case 'create_business_flow': {
          let nodeIds: string[] = [];
          let edgeIds: string[] = [];
          if (args.node_ids_json) {
            try { nodeIds = JSON.parse(args.node_ids_json as string); } catch(e){}
          }
          if (args.edge_ids_json) {
            try { edgeIds = JSON.parse(args.edge_ids_json as string); } catch(e){}
          }
          const flow = await store.addBusinessFlow(args.project_id as string, {
            name: args.name as string,
            description: args.description as string,
            nodeIds,
            edgeIds
          });
          if (!flow) return { content: [{ type: 'text', text: 'Project not found' }] };
          return { content: [{ type: 'text', text: `Business flow created:\n${JSON.stringify(flow, null, 2)}` }] };
        }
        case 'update_business_flow': {
          const updates: any = {};
          if (args.name) updates.name = args.name;
          if (args.description) updates.description = args.description;
          if (args.node_ids_json) {
            try { updates.nodeIds = JSON.parse(args.node_ids_json as string); } catch(e){}
          }
          if (args.edge_ids_json) {
            try { updates.edgeIds = JSON.parse(args.edge_ids_json as string); } catch(e){}
          }
          const flow = await store.updateBusinessFlow(args.project_id as string, args.flow_id as string, updates);
          if (!flow) return { content: [{ type: 'text', text: 'Flow not found' }] };
          return { content: [{ type: 'text', text: `Business flow updated:\n${JSON.stringify(flow, null, 2)}` }] };
        }
        case 'delete_business_flow': {
          const ok = await store.deleteBusinessFlow(args.project_id as string, args.flow_id as string);
          return { content: [{ type: 'text', text: ok ? `Flow deleted` : `Flow not found` }] };
        }
        
        case 'query_project': {
          const p = await store.getProject(args.project_id as string);
          if (!p) return { content: [{ type: 'text', text: 'Project not found' }] };
          
          if (args.summary) {
            let entitiesText = p.nodes.map(n => `- ${n.label} (${n.sublabel || n.type})${n.regionId ? ` [in: ${n.regionId}]` : ''}`).join('\n');
            let flowsText = p.edges.map((e, i) => `${i}. ${e.label} (${e.dir})`).join('\n');
            let regionsText = p.regions.map(r => `- ${r.title}`).join('\n');
            const summaryText = `# ${p.name} ${p.version}\n- Entities: ${p.nodes.length}\n- Data Flows: ${p.edges.length}\n- Regions: ${p.regions.length}\n\n## Entities\n${entitiesText || '(none)'}\n\n## Data Flows\n${flowsText || '(none)'}\n\n## Regions\n${regionsText || '(none)'}`;
            return { content: [{ type: 'text', text: summaryText }] };
          }
          
          return { content: [{ type: 'text', text: JSON.stringify(p, null, 2) }] };
        }
        case 'format_canvas': {
          const { project_id } = args as any;
          if (!project_id) throw new McpError(ErrorCode.InvalidParams, 'Missing project_id');
          const success = await store.formatCanvas(project_id);
          if (!success) throw new McpError(ErrorCode.InternalError, 'Project not found or failed to format');
          return { content: [{ type: 'text', text: `Canvas for project ${project_id} formatted successfully.` }] };
        }
        case 'validate_project': {
          const { project_id } = args as any;
          if (!project_id) throw new McpError(ErrorCode.InvalidParams, 'Missing project_id');
          const result = await store.validateProject(project_id);
          if (!result) throw new McpError(ErrorCode.InternalError, 'Project not found');
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'search': {
          const { project_id, query } = args as any;
          if (!project_id || query === undefined) throw new McpError(ErrorCode.InvalidParams, 'Missing project_id or query');
          const result = await store.searchProject(project_id, query);
          if (!result) throw new McpError(ErrorCode.InternalError, 'Project not found');
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });
}
