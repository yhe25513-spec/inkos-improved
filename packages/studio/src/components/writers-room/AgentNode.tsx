import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

// Inline type to avoid import resolution issues
interface AgentPersona {
  id: string;
  name: string;
  role: "character" | "meta" | "director";
  description: string;
  goals: ReadonlyArray<string>;
  personality: {
    traits: ReadonlyArray<string>;
    speechStyle: string;
    forbiddenBehaviors: ReadonlyArray<string>;
  };
  prompt: string;
}

interface AgentNodeData {
  agent: AgentPersona;
  isSelected: boolean;
  onClick: () => void;
}

function AgentNodeComponent({ data }: NodeProps<AgentNodeData>) {
  const { agent, isSelected, onClick } = data;

  const roleColors: Record<string, string> = {
    character: "#3b82f6", // blue
    meta: "#8b5cf6", // purple
    director: "#f59e0b", // amber
  };

  const roleLabels: Record<string, string> = {
    character: "角色",
    meta: "元",
    director: "总监",
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 20px",
        borderRadius: "8px",
        border: `2px solid ${isSelected ? "#ffffff" : roleColors[agent.role]}`,
        background: isSelected ? roleColors[agent.role] : "#1f2937",
        color: "white",
        cursor: "pointer",
        minWidth: "120px",
        textAlign: "center",
        boxShadow: isSelected ? `0 0 20px ${roleColors[agent.role]}` : "none",
        transition: "all 0.2s",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: "bold", fontSize: "14px" }}>{agent.name}</div>
      <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
        {roleLabels[agent.role]}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
