export function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }

  return null;
}

function generateId(): string {
  return 'node-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function autoFixWorkflow(workflow: Record<string, unknown>): { workflow: Record<string, unknown>; fixes: string[] } {
  const fixes: string[] = [];
  const nodes = workflow.nodes as Array<Record<string, unknown>> | undefined;
  if (!nodes) return { workflow, fixes };

  const hasWebhook = nodes.some((node) => node.type === 'n8n-nodes-base.webhook');
  const hasRespond = nodes.some((node) => node.type === 'n8n-nodes-base.respondToWebhook');

  if (hasWebhook && !hasRespond) {
    const webhookNode = nodes.find((node) => node.type === 'n8n-nodes-base.webhook');
    const webhookName = (webhookNode?.name as string) || 'Webhook';
    const respondNode = {
      id: generateId(),
      name: 'Balas Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: { respondWith: 'json', options: {} },
    };

    const lastNode = nodes[nodes.length - 1];
    const lastX = ((lastNode?.position as number[])?.[0] || 250) + 250;
    respondNode.position = [lastX, 300];
    nodes.push(respondNode);

    let connections = workflow.connections as Record<string, unknown> | undefined;
    if (!connections) connections = {};

    const webhookConns = connections[webhookName] as Array<Array<Record<string, unknown>>> | undefined;
    if (webhookConns && webhookConns.length > 0) {
      const firstTarget = webhookConns[0]?.[0]?.node;
      if (firstTarget) {
        connections[respondNode.name] = [[{ node: firstTarget, type: 'main', index: 0 }]];
        webhookConns[0] = [{ node: respondNode.name, type: 'main', index: 0 }];
      }
    }

    workflow.connections = connections;
    fixes.push('Auto-fix: Menambahkan Respond to Webhook node karena Webhook trigger ditemukan tanpa Respond to Webhook');
  }

  for (const node of nodes) {
    if (!node.id || node.id === '') {
      node.id = generateId();
      fixes.push(`Auto-fix: Mengisi ID kosong untuk node "${node.name}"`);
    }
    if (!node.typeVersion && node.typeVersion !== 0) {
      const typeStr = (node.type as string) || '';
      node.typeVersion = typeStr.includes('webhook') || typeStr.includes('httpRequest') || typeStr.includes('set') ? 2 : 1;
      fixes.push(`Auto-fix: Mengisi typeVersion untuk node "${node.name}"`);
    }
  }

  return { workflow, fixes };
}
