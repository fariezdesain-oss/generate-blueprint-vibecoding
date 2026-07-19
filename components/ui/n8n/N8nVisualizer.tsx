'use client';

import { useState, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MarkerType,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { N8nNode } from './N8nNode';
import { X, Code2 } from 'lucide-react';

const nodeTypes = {
  n8nNode: N8nNode,
};

interface N8nVisualizerProps {
  workflowJson: string;
}

export function N8nVisualizer({ workflowJson }: N8nVisualizerProps) {
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);

  // Parse JSON n8n menjadi format React Flow
  const { nodes, edges } = useMemo(() => {
    try {
      const parsed = JSON.parse(workflowJson);
      const rawNodes = parsed.nodes || [];
      const rawConnections = parsed.connections || {};

      // Buat Nodes
      const rfNodes: Node[] = rawNodes.map((n: any) => ({
        id: n.name || n.id,
        type: 'n8nNode',
        position: { 
          x: n.position?.[0] || Math.random() * 500, 
          y: n.position?.[1] || Math.random() * 300 
        },
        data: { 
          label: n.name, 
          type: n.type,
          ...n 
        },
      }));

      // Buat Edges (Connections)
      const rfEdges: Edge[] = [];
      Object.keys(rawConnections).forEach(sourceNodeName => {
        const connections = rawConnections[sourceNodeName].main || [];
        connections.forEach((connGroup: any[]) => {
          connGroup.forEach((connTarget: any) => {
            rfEdges.push({
              id: `e-${sourceNodeName}-${connTarget.node}`,
              source: sourceNodeName,
              target: connTarget.node,
              type: 'smoothstep',
              animated: true,
              style: { stroke: 'var(--border)', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: 'var(--border)',
              },
            });
          });
        });
      });

      return { nodes: rfNodes, edges: rfEdges };
    } catch (e) {
      console.error("Gagal parsing JSON n8n", e);
      return { nodes: [], edges: [] };
    }
  }, [workflowJson]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeData(node.data);
  }, []);

  return (
    <div className="w-full h-full relative brutal-card flex flex-col overflow-hidden bg-[var(--bg-primary)] min-h-[600px]">
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        className="bg-primary"
      >
        <Background gap={20} color="var(--border)" className="opacity-20" />
        <Controls className="!bg-secondary !border-2 !border-border !shadow-[2px_2px_0_var(--border)] !rounded-none overflow-hidden [&>button]:!border-b [&>button]:!border-border [&>button]:!text-primary hover:[&>button]:!bg-tertiary" />
      </ReactFlow>

      {/* Modal Popup Detail JSON */}
      {selectedNodeData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4 sm:p-6 animate-fade-in">
          <div className="brutal-card w-full max-w-3xl bg-secondary max-h-[85vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-4 border-b-2 border-border bg-tertiary">
              <div className="flex items-center gap-2">
                <div className="brutal-icon size-8 min-w-8 min-h-8 rounded-md bg-gemini-orange">
                  <Code2 size={14} className="text-[#111]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-primary">{selectedNodeData.label}</h3>
                  <p className="text-[10px] text-tertiary">{selectedNodeData.type}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNodeData(null)}
                className="brutal-button !min-h-0 size-8 p-0 flex items-center justify-center bg-gemini-red !shadow-[2px_2px_0_var(--border)]"
              >
                <X size={16} className="text-[#111]" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-xs p-4 rounded bg-[#111] text-gemini-green overflow-x-auto whitespace-pre-wrap break-all">
                <code>
                  {JSON.stringify(selectedNodeData, null, 2)}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
