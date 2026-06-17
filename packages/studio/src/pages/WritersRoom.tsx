import React, { useState, useEffect } from "react";
import { AgentGraph } from "../components/writers-room/AgentGraph";
import { fetchJson } from "../hooks/use-api";

// Generate agents from book characters
function generateAgentsFromBook(characters: Array<{name: string, role: string, description?: string}>) {
  const agents = characters.map((char) => ({
    id: char.name,
    name: char.name,
    role: "character" as const,
    description: char.description || "",
    goals: [],
    personality: {
      traits: [],
      speechStyle: "",
      forbiddenBehaviors: [],
    },
    prompt: `你是${char.name}。请基于你的角色设定发表看法。`,
  }));

  // Add meta agents
  agents.push({
    id: "author",
    name: "作者",
    role: "character" as const,
    description: "创世神，掌控一切",
    goals: ["写出好故事"],
    personality: { traits: ["全知", "理性"], speechStyle: "导演式", forbiddenBehaviors: [] },
    prompt: "你是作者。你需要平衡各方，写出好故事。",
  });
  agents.push({
    id: "reader",
    name: "读者",
    role: "character" as const,
    description: "目标读者",
    goals: ["看到爽点"],
    personality: { traits: ["挑剔", "期待高"], speechStyle: "直接吐槽", forbiddenBehaviors: [] },
    prompt: "你是读者代表。你不能容忍无聊。",
  });

  return agents;
}

// Generate relationships between agents
function generateRelationships(agents: Array<{id: string, name: string, role: string}>) {
  const relationships: Array<{source: string, target: string, type: string, strength: number, description: string}> = [];

  // Add relationships between characters
  const characters = agents.filter(a => a.role === "character");
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      // Default neutral relationship
      relationships.push({
        source: characters[i].id,
        target: characters[j].id,
        type: "neutral",
        strength: 50,
        description: "同在故事中",
      });
    }
  }

  // Add meta agent relationships
  const metaAgents = agents.filter(a => a.role === "meta");
  for (const meta of metaAgents) {
    for (const char of characters) {
      relationships.push({
        source: meta.id,
        target: char.id,
        type: "neutral",
        strength: 40,
        description: meta.name === "作者" ? "作者与角色" : "读者与角色",
      });
    }
  }

  return relationships;
}

interface WritersRoomProps {
  bookId?: string;
}

export function WritersRoom({ bookId: propBookId }: WritersRoomProps) {
  const [agents, setAgents] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const [discussionTopic, setDiscussionTopic] = useState("");
  const [discussion, setDiscussion] = useState<Array<{agent: string, message: string}>>([]);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load characters from book
  useEffect(() => {
    if (!propBookId) {
      setLoading(false);
      setError("请先选择一本书");
      return;
    }

    setLoading(true);
    setError(null);

    fetchJson(`/books/${propBookId}/characters`)
      .then((data: any) => {
        if (data.characters && data.characters.length > 0) {
          const newAgents = generateAgentsFromBook(data.characters);
          setAgents(newAgents);
          setRelationships(generateRelationships(newAgents));
        } else {
          setError("这本书还没有角色，请先在角色管理中创建角色");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load characters:", err);
        setError("加载角色失败");
        setLoading(false);
      });
  }, [propBookId]);

  // Start real discussion using LLM
  const startDiscussion = async () => {
    if (!discussionTopic.trim() || agents.length === 0) return;
    setIsDiscussing(true);
    setDiscussion([]);

    // For each agent, get their response
    for (const agent of agents) {
      try {
        const data = await fetchJson("/discussion/respond", {
          method: "POST",
          body: JSON.stringify({
            agentId: agent.id,
            agentName: agent.name,
            agentPrompt: agent.prompt,
            topic: discussionTopic,
            previousMessages: discussion,
            relationships: relationships.filter(r => r.source === agent.id || r.target === agent.id),
          }),
        });
        setDiscussion(prev => [...prev, { agent: agent.name, message: (data as any).response || "..." }]);
      } catch {
        setDiscussion(prev => [...prev, { agent: agent.name, message: "（网络错误）" }]);
      }
    }
    setIsDiscussing(false);
  };

  const graph = {
    metadata: { name: "Agent关系图", description: "", version: "1.0", createdAt: "" },
    agents,
    relationships,
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", color: "white", textAlign: "center" }}>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px", color: "white", textAlign: "center" }}>
        <p style={{ color: "#f59e0b" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", color: "white" }}>
      <h1 style={{ marginBottom: "20px" }}>编剧室</h1>
      {propBookId && <p style={{ marginBottom: "10px", opacity: 0.7 }}>当前书籍: {propBookId}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Agent Graph */}
        <div style={{ background: "#1f2937", borderRadius: "12px", padding: "20px" }}>
          <h2 style={{ marginBottom: "15px" }}>Agent 关系图</h2>
          <AgentGraph graph={graph} onNodeClick={setSelectedAgent} selectedAgent={selectedAgent} />
        </div>

        {/* Discussion Panel */}
        <div style={{ background: "#1f2937", borderRadius: "12px", padding: "20px" }}>
          <h2 style={{ marginBottom: "15px" }}>实时讨论</h2>

          {/* Topic Input */}
          <div style={{ marginBottom: "15px" }}>
            <input
              type="text"
              value={discussionTopic}
              onChange={(e) => setDiscussionTopic(e.target.value)}
              placeholder="输入讨论话题，例如：下一章怎么写？"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#374151",
                color: "white",
                marginBottom: "10px",
              }}
            />
            <button
              onClick={startDiscussion}
              disabled={isDiscussing || !discussionTopic.trim()}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: isDiscussing ? "#6b7280" : "#3b82f6",
                color: "white",
                cursor: isDiscussing ? "not-allowed" : "pointer",
              }}
            >
              {isDiscussing ? "讨论中..." : "开始讨论"}
            </button>
          </div>

          {/* Discussion Messages */}
          <div style={{ height: "300px", overflow: "auto" }}>
            {discussion.length === 0 ? (
              <p style={{ opacity: 0.5 }}>输入话题后点击"开始讨论"</p>
            ) : (
              discussion.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px",
                    marginBottom: "8px",
                    background: "#374151",
                    borderRadius: "8px",
                  }}
                >
                  <strong>{msg.agent}：</strong> {msg.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Agent Details */}
      {selectedAgent && (
        <div style={{ marginTop: "20px", background: "#1f2937", borderRadius: "12px", padding: "20px" }}>
          <h2>Agent 详情</h2>
          {(() => {
            const agent = agents.find((a) => a.id === selectedAgent);
            if (!agent) return null;
            return (
              <div>
                <p><strong>名称：</strong> {agent.name}</p>
                <p><strong>角色：</strong> {agent.role}</p>
                <p><strong>描述：</strong> {agent.description}</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
