import { Handle, Position } from 'reactflow';
import { Zap, Send, Globe, Database, Box, Play } from 'lucide-react';

interface N8nNodeProps {
  data: {
    label: string;
    type: string;
    [key: string]: any;
  };
  isConnectable: boolean;
}

export function N8nNode({ data, isConnectable }: N8nNodeProps) {
  // Logic untuk menentukan warna header dan icon berdasarkan tipe/nama node
  let headerColor = 'bg-gemini-teal'; // Default abu/teal
  let Icon = Box;

  const nodeName = data.label?.toLowerCase() || '';
  const nodeType = data.type?.toLowerCase() || '';

  if (nodeType.includes('trigger') || nodeType.includes('webhook') || nodeType.includes('schedule')) {
    headerColor = 'bg-gemini-green'; // Hijau untuk Trigger
    Icon = nodeType.includes('schedule') ? Play : Zap;
  } else if (nodeName.includes('http') || nodeName.includes('api') || nodeType.includes('http')) {
    headerColor = 'bg-gemini-blue'; // Biru untuk HTTP/API
    Icon = Globe;
  } else if (nodeName.includes('slack') || nodeName.includes('telegram') || nodeName.includes('discord') || nodeName.includes('message')) {
    headerColor = 'bg-gemini-purple'; // Ungu untuk Komunikasi
    Icon = Send;
  } else if (nodeName.includes('postgres') || nodeName.includes('database') || nodeName.includes('supabase') || nodeName.includes('mysql')) {
    headerColor = 'bg-gemini-orange'; // Oranye untuk Database
    Icon = Database;
  }

  return (
    <div className="brutal-card min-w-[200px] flex flex-col overflow-hidden bg-secondary transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--gemini-orange)] cursor-pointer">
      {/* Target masuk (Input) */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-gemini-orange !border-2 !border-border rounded-none -ml-1.5"
      />
      
      {/* Header Node */}
      <div className={`${headerColor} px-3 py-2 flex items-center gap-2 border-b-2 border-border`}>
        <div className="bg-white/20 p-1 rounded">
          <Icon size={14} className="text-[#111]" />
        </div>
        <span className="font-bold text-xs text-[#111] truncate">{data.label}</span>
      </div>

      {/* Body Node */}
      <div className="px-3 py-2 text-[10px] text-tertiary">
        <span className="truncate block opacity-70">{data.type}</span>
      </div>

      {/* Target keluar (Output) */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-gemini-blue !border-2 !border-border rounded-none -mr-1.5"
      />
    </div>
  );
}
