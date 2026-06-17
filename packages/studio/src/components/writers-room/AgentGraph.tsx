import React, { useMemo } from "react";
import ReactFlow, { type Node, type Edge, Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

import { AgentNode } from "./AgentNode";
import { RelationshipEdge } from "./RelationshipEdge";

// Inline types to avoid import resolution issues
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

interface AgentRelationship {
  source: string;
  target: string;
  type: string;
  strength: number;
  description: string;
}

export interface AgentGraph {
  agents: ReadonlyArray<AgentPersona>;
  relationships: ReadonlyArray<AgentRelationship>;
  metadata: {
    name: string;
    description: string;
    version: string;
    createdAt: string;
  };
}

interface AgentGraphProps {
  graph: AgentGraph;
  onNodeClick?: (agentId: string) => void;
  selectedAgent?: string;
}

export function AgentGraph({ graph, onNodeClick, selectedAgent }: AgentGraphProps) {
  // Convert agents to React Flow nodes
  const nodes: Node[] = useMemo(() => {
    return graph.agents.map((agent, index) => ({
      id: agent.id,
      type: "agentNode",
      position: calculatePosition(index, graph.agents.length),
      data: {
        agent,
        isSelected: agent.id === selectedAgent,
        onClick: () => onNodeClick?.(agent.id),
      },
    }));
  }, [graph.agents, selectedAgent, onNodeClick]);

  // Convert relationships to React Flow edges
  const edges: Edge[] = useMemo(() => {
    return graph.relationships.map((rel, index) => ({
      id: `edge-${index}`,
      source: rel.source,
      target: rel.target,
      type: "relationshipEdge",
      data: {
        relationship: rel,
      },
      animated: rel.strength > 70,
    }));
  }, [graph.relationships]);

  return (
    <div style={{ width: "100%", height: "500px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ agentNode: AgentNode }}
        edgeTypes={{ relationshipEdge: RelationshipEdge }}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function calculatePosition(index: number, total: number): { x: number; y: number } {
  // Arrange in a circle
  const radius = 200;
  const angle = (2 * Math.PI * index) / total;
  return {
    x: 400 + radius * Math.cos(angle),
    y: 250 + radius * Math.sin(angle),
  };
}
