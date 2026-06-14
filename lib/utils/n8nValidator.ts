interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  workflow: Record<string, unknown> | null;
}

const KNOWN_NODE_PREFIXES = [
  'n8n-nodes-base.',
  'n8n-nodes-langchain.',
  '@n8n/',
];

const WEHBOOK_TYPE = 'n8n-nodes-base.webhook';
const RESPOND_WEHBOOK_TYPE = 'n8n-nodes-base.respondToWebhook';
const STICKY_NOTE_TYPE = 'n8n-nodes-base.stickyNote';

export function validateN8nWorkflow(
  workflowJson: string,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(workflowJson) as Record<string, unknown>;
  } catch {
    return { valid: false, errors: ['Invalid JSON: cannot parse workflow'], warnings: [], workflow: null };
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    errors.push('Missing or invalid "name" field');
  }

  const nodes = parsed.nodes as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Missing or empty "nodes" array');
    return { valid: false, errors, warnings: [], workflow: null };
  }

  if (nodes.length < 2) {
    errors.push('Workflow harus memiliki minimal 2 node (trigger + action)');
  }

  const nodeNames = new Set<string>();
  const nodeIds = new Set<string>();
  let hasWebhook = false;
  let hasRespondWebhook = false;
  let hasTrigger = false;

  for (const node of nodes) {
    if (!node.name || typeof node.name !== 'string') {
      errors.push(`Node ${node.id || '(no id)'} missing "name"`);
    } else if (nodeNames.has(node.name)) {
      errors.push(`Duplicate node name: "${node.name}"`);
    } else {
      nodeNames.add(node.name);
    }

    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Node "${node.name || '(no id)'}" missing "id"`);
    } else if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id: "${node.id}"`);
    } else {
      nodeIds.add(node.id);
    }

    if (!node.type || typeof node.type !== 'string') {
      errors.push(`Node "${node.name || node.id || '(no id)'}" missing "type"`);
    } else {
      const nodeType = node.type as string;
      const isValidType = KNOWN_NODE_PREFIXES.some((p) => nodeType.startsWith(p));
      if (!isValidType) {
        errors.push(`Node "${node.name}" has unrecognized type "${nodeType}" — harus dimulai dengan prefix "n8n-nodes-base.", "n8n-nodes-langchain.", atau "@n8n/"`);
      }
      if (nodeType === WEHBOOK_TYPE) {
        hasWebhook = true;
        hasTrigger = true;
      }
      if (nodeType === RESPOND_WEHBOOK_TYPE) {
        hasRespondWebhook = true;
      }
      if (nodeType === 'n8n-nodes-base.scheduleTrigger') {
        hasTrigger = true;
      }
    }

    if (!node.parameters || typeof node.parameters !== 'object') {
      errors.push(`Node "${node.name}" missing "parameters"`);
    } else {
      const params = node.parameters as Record<string, unknown>;
      const nodeType = (node.type as string) || '';

      if (nodeType === WEHBOOK_TYPE) {
        if (!params.path || (typeof params.path === 'string' && params.path.trim() === '')) {
          errors.push(`Webhook node "${node.name}" harus memiliki parameter "path" yang terisi`);
        }
      }

      if (nodeType === 'n8n-nodes-base.httpRequest') {
        if (!params.url || (typeof params.url === 'string' && params.url.trim() === '')) {
          errors.push(`HTTP Request node "${node.name}" harus memiliki parameter "url" yang terisi`);
        }
      }
    }

    if (node.type !== STICKY_NOTE_TYPE && node.type !== 'n8n-nodes-base.noOp') {
      const typeVersion = node.typeVersion;
      if (typeVersion === undefined || typeVersion === null) {
        warnings.push(`Node "${node.name}" tidak memiliki "typeVersion" — gunakan typeVersion: 1 atau 2`);
      }
    }
  }

  if (hasWebhook && !hasRespondWebhook) {
    errors.push('Workflow menggunakan Webhook trigger tetapi tidak memiliki Respond to Webhook node. Tambahkan node "Respond to Webhook" yang terhubung setelah Webhook.');
  }

  if (!hasTrigger) {
    errors.push('Workflow tidak memiliki trigger node. Tambahkan minimal satu trigger: Webhook, Schedule Trigger, atau Manual trigger.');
  }

  const connections = parsed.connections as Record<string, unknown> | undefined;
  if (!connections || typeof connections !== 'object') {
    errors.push('Missing or invalid "connections"');
  } else {
    const connectedNodes = new Set<string>();
    const activeNodeNames = new Set(
      nodes.filter(n => n.type !== STICKY_NOTE_TYPE).map(n => n.name as string)
    );

    for (const [sourceName, targets] of Object.entries(connections)) {
      if (!nodeNames.has(sourceName)) {
        errors.push(`Connection references non-existent source node: "${sourceName}"`);
        continue;
      }
      connectedNodes.add(sourceName);

      if (Array.isArray(targets)) {
        for (const outputGroup of targets) {
          if (Array.isArray(outputGroup)) {
            for (const conn of outputGroup as Array<Record<string, unknown>>) {
              if (conn.node) {
                if (!nodeNames.has(conn.node as string)) {
                  errors.push(`Connection references non-existent target node: "${conn.node}"`);
                } else {
                  connectedNodes.add(conn.node as string);
                }
              }
            }
          }
        }
      }
    }

    for (const nodeName of activeNodeNames) {
      if (!connectedNodes.has(nodeName)) {
        warnings.push(`Node "${nodeName}" tidak terhubung ke node lain (orphan node). Pastikan node ini terhubung dalam alur workflow.`);
      }
    }

    if (hasWebhook && hasRespondWebhook) {
      const webhookName = nodes.find(n => n.type === WEHBOOK_TYPE)?.name as string;
      const respondName = nodes.find(n => n.type === RESPOND_WEHBOOK_TYPE)?.name as string;
      if (webhookName && respondName) {
        const webhookConns = connections[webhookName] as Array<Array<Record<string, unknown>>> | undefined;
        const respondConnected = webhookConns?.some(group =>
          group.some(conn => conn.node === respondName)
        );
        if (!respondConnected) {
          errors.push(`Webhook node "${webhookName}" harus terhubung ke Respond to Webhook node "${respondName}"`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    workflow: errors.length === 0 ? parsed : null,
  };
}
