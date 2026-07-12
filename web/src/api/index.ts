const API_BASE = 'http://localhost:8081/api'

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  // Projects
  listProjects: () => request('/projects'),
  getProject: (id: string) => request(`/projects/${id}`),
  createProject: (name: string) =>
    request('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteProject: (id: string) =>
    request(`/projects/${id}`, { method: 'DELETE' }),

  // Nodes
  addNode: (projectId: string, node: any) =>
    request(`/projects/${projectId}/nodes`, { method: 'POST', body: JSON.stringify(node) }),
  updateNode: (projectId: string, nodeId: string, updates: any) =>
    request(`/projects/${projectId}/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteNode: (projectId: string, nodeId: string) =>
    request(`/projects/${projectId}/nodes/${nodeId}`, { method: 'DELETE' }),

  // Edges
  addEdge: (projectId: string, edge: any) =>
    request(`/projects/${projectId}/edges`, { method: 'POST', body: JSON.stringify(edge) }),
  deleteEdge: (projectId: string, idx: number) =>
    request(`/projects/${projectId}/edges/${idx}`, { method: 'DELETE' }),

  // Regions
  addRegion: (projectId: string, region: any) =>
    request(`/projects/${projectId}/regions`, { method: 'POST', body: JSON.stringify(region) }),
  updateRegion: (projectId: string, regionId: string, updates: any) =>
    request(`/projects/${projectId}/regions/${regionId}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteRegion: (projectId: string, regionId: string) =>
    request(`/projects/${projectId}/regions/${regionId}`, { method: 'DELETE' }),

  // Business Flows
  addBusinessFlow: (projectId: string, flow: any) =>
    request(`/projects/${projectId}/business-flows`, { method: 'POST', body: JSON.stringify(flow) }),
  updateBusinessFlow: (projectId: string, flowId: string, updates: any) =>
    request(`/projects/${projectId}/business-flows/${flowId}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteBusinessFlow: (projectId: string, flowId: string) =>
    request(`/projects/${projectId}/business-flows/${flowId}`, { method: 'DELETE' }),
}
