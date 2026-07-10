// Shared utility functions for Netlify function and TS codebase.
// ponytail: keep in sync with generate.ts and n8nValidator.ts.

export function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function generateId() {
  return 'node-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function autoFixWorkflow(workflow) {
  const fixes = [];
  const nodes = workflow.nodes;
  if (!Array.isArray(nodes)) return { workflow, fixes };

  const hasWebhook = nodes.some(n => n.type === 'n8n-nodes-base.webhook');
  const hasRespond = nodes.some(n => n.type === 'n8n-nodes-base.respondToWebhook');

  if (hasWebhook && !hasRespond) {
    const webhookNode = nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    const webhookName = (webhookNode?.name) || 'Webhook';
    const respondNode = {
      id: generateId(),
      name: 'Balas Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: { respondWith: 'json', options: {} },
    };

    const lastNode = nodes[nodes.length - 1];
    const lastX = (lastNode?.position?.[0] || 250) + 250;
    respondNode.position = [lastX, 300];
    nodes.push(respondNode);

    let connections = workflow.connections || {};
    const webhookConns = connections[webhookName];
    if (webhookConns && webhookConns.length > 0) {
      const firstTarget = webhookConns[0]?.[0]?.node;
      if (firstTarget) {
        connections[respondNode.name] = [[{ node: firstTarget, type: 'main', index: 0 }]];
        webhookConns[0] = [{ node: respondNode.name, type: 'main', index: 0 }];
      }
    }
    workflow.connections = connections;
    fixes.push('Auto-fix: Menambahkan Respond to Webhook node');
  }

  for (const node of nodes) {
    if (!node.id || node.id === '') {
      node.id = generateId();
      fixes.push(`Auto-fix: Mengisi ID untuk node "${node.name}"`);
    }
    if (node.typeVersion === undefined || node.typeVersion === null) {
      const typeStr = node.type || '';
      if (typeStr.includes('webhook') || typeStr.includes('httpRequest') || typeStr.includes('set')) {
        node.typeVersion = 2;
      } else {
        node.typeVersion = 1;
      }
      fixes.push(`Auto-fix: Mengisi typeVersion untuk node "${node.name}"`);
    }
  }

  return { workflow, fixes };
}

export function validateN8nWorkflow(workflowJson) {
  const errors = [];
  const warnings = [];
  const KNOWN_PREFIXES = ['n8n-nodes-base.', 'n8n-nodes-langchain.', '@n8n/'];

  let parsed;
  try {
    parsed = JSON.parse(workflowJson);
  } catch {
    return { valid: false, errors: ['Invalid JSON'], warnings: [], workflow: null };
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    errors.push('Missing or invalid "name"');
  }

  const nodes = parsed.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Missing or empty "nodes"');
    return { valid: false, errors, warnings: [], workflow: null };
  }

  if (nodes.length < 2) {
    errors.push('Minimal 2 nodes');
  }

  const nodeNames = new Set();
  const nodeIds = new Set();
  let hasWebhook = false;
  let hasRespondWebhook = false;
  let hasTrigger = false;

  for (const node of nodes) {
    if (!node.name || typeof node.name !== 'string') {
      errors.push(`Node missing name`);
    } else if (nodeNames.has(node.name)) {
      errors.push(`Duplicate name: "${node.name}"`);
    } else {
      nodeNames.add(node.name);
    }

    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Node "${node.name}" missing id`);
    } else if (nodeIds.has(node.id)) {
      errors.push(`Duplicate id: "${node.id}"`);
    } else {
      nodeIds.add(node.id);
    }

    if (!node.type || typeof node.type !== 'string') {
      errors.push(`Node "${node.name}" missing type`);
    } else {
      const nodeType = node.type;
      const valid = KNOWN_PREFIXES.some(p => nodeType.startsWith(p));
      if (!valid) errors.push(`Node "${node.name}" invalid type prefix`);
      if (nodeType === 'n8n-nodes-base.webhook') { hasWebhook = true; hasTrigger = true; }
      if (nodeType === 'n8n-nodes-base.respondToWebhook') hasRespondWebhook = true;
      if (nodeType === 'n8n-nodes-base.scheduleTrigger') hasTrigger = true;
    }
  }

  if (hasWebhook && !hasRespondWebhook) {
    errors.push('Webhook tanpa Respond to Webhook');
  }
  if (!hasTrigger) {
    errors.push('Tidak ada trigger node');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    workflow: errors.length === 0 ? parsed : null,
  };
}
