import express from 'express';
import cors from 'cors';
import { Store } from './store.js';

export function createApiRouter(store: Store) {
  const router = express.Router();
  
  router.use(cors());
  router.use(express.json());

  // Projects
  router.get('/projects', async (req, res) => {
    try {
      const projects = await store.listProjects();
      res.json(projects);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/projects', async (req, res) => {
    try {
      const name = req.body.name;
      if (!name) return res.status(400).json({ error: 'name required' });
      const p = await store.createProject(name);
      res.status(201).json(p);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/projects/:id', async (req, res) => {
    const p = await store.getProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(p);
  });

  router.delete('/projects/:id', async (req, res) => {
    const success = await store.deleteProject(req.params.id);
    if (success) res.status(204).send();
    else res.status(404).json({ error: 'not found' });
  });

  router.put('/projects/:id', async (req, res) => {
    const p = await store.updateProject(req.params.id, req.body);
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(p);
  });

  // Nodes
  router.post('/projects/:id/nodes', async (req, res) => {
    const result = await store.addNode(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'project not found' });
    res.status(201).json(result);
  });

  router.put('/projects/:id/nodes/:nodeId', async (req, res) => {
    const result = await store.updateNode(req.params.id, req.params.nodeId, req.body);
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  });

  router.delete('/projects/:id/nodes/:nodeId', async (req, res) => {
    const success = await store.deleteNode(req.params.id, req.params.nodeId);
    if (success) res.status(204).send();
    else res.status(404).json({ error: 'not found' });
  });

  // Edges
  router.post('/projects/:id/edges', async (req, res) => {
    const result = await store.addEdge(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'project not found' });
    res.status(201).json(result);
  });

  router.delete('/projects/:id/edges/:edgeId', async (req, res) => {
    const success = await store.deleteEdge(req.params.id, req.params.edgeId);
    if (success) res.status(204).send();
    else res.status(404).json({ error: 'not found' });
  });

  router.put('/projects/:id/edges/:edgeId', async (req, res) => {
    const result = await store.updateEdge(req.params.id, req.params.edgeId, req.body);
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  });

  // Regions
  router.post('/projects/:id/regions', async (req, res) => {
    const result = await store.addRegion(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'project not found' });
    res.status(201).json(result);
  });

  router.put('/projects/:id/regions/:regionId', async (req, res) => {
    const result = await store.updateRegion(req.params.id, req.params.regionId, req.body);
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  });

  router.delete('/projects/:id/regions/:regionId', async (req, res) => {
    const success = await store.deleteRegion(req.params.id, req.params.regionId);
    if (success) res.status(204).send();
    else res.status(404).json({ error: 'not found' });
  });

  // Business Flows
  router.post('/projects/:id/business-flows', async (req, res) => {
    const result = await store.addBusinessFlow(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'project not found' });
    res.status(201).json(result);
  });

  router.put('/projects/:id/business-flows/:flowId', async (req, res) => {
    const result = await store.updateBusinessFlow(req.params.id, req.params.flowId, req.body);
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  });

  router.delete('/projects/:id/business-flows/:flowId', async (req, res) => {
    const success = await store.deleteBusinessFlow(req.params.id, req.params.flowId);
    if (success) res.status(204).send();
    else res.status(404).json({ error: 'not found' });
  });

  return router;
}
