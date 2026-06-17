import React from "react";
import { getBezierPath, type EdgeProps } from "reactflow";

// Inline type to avoid import resolution issues
interface AgentRelationship {
  source: string;
  target: string;
  type: string;
  strength: number;
  description: string;
}

interface RelationshipEdgeData {
  relationship: AgentRelationship;
}

const typeColors: Record<string, string> = {
  ally: "#22c55e", // green
  enemy: "#ef4444", // red
  neutral: "#6b7280", // gray
  superior: "#f59e0b", // amber
  subordinate: "#3b82f6", // blue
  protective: "#8b5cf6", // purple
  suspicious: "#f97316", // orange
};

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<RelationshipEdgeData>) {
  const { relationship } = data!;

  const color = typeColors[relationship.type] || "#6b7280";
  const strokeWidth = Math.max(2, relationship.strength / 20);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{
          stroke: color,
          strokeWidth,
          fill: "none",
        }}
        className="react-flow__edge-path"
        d={edgePath}
      />
      <foreignObject
        x={labelX - 40}
        y={labelY - 10}
        width="80"
        height="20"
        style={{ overflow: "visible" }}
      >
        <div
          style={{
            fontSize: "10px",
            color: color,
            textAlign: "center",
            background: "#1f2937",
            padding: "2px 6px",
            borderRadius: "4px",
            border: `1px solid ${color}`,
          }}
        >
          {relationship.type} ({relationship.strength})
        </div>
      </foreignObject>
    </>
  );
}
