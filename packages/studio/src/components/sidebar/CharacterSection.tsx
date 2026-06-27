import { useEffect, useState } from "react";
import { Users, ChevronDown, Sparkles, CalendarCheck, Tag } from "lucide-react";
import { fetchJson } from "../../hooks/use-api";
import { SidebarCard } from "./SidebarCard";
import { cn } from "../../lib/utils";
import { roleFromPath, type RoleRef } from "../../lib/truth-display";
import { useChatStore } from "../../store/chat";

interface CharacterInfo {
  name: string;
  fields: Record<string, string>;
}

interface EntitySummary {
  readonly name: string;
  readonly type: string;
  readonly firstAppearance: number;
  readonly lastAppearance: number;
  readonly aliases?: ReadonlyArray<string>;
  readonly personality?: string;
}

function parseCharacterMatrix(md: string): CharacterInfo[] {
  const characters: CharacterInfo[] = [];
  const sections = md.split(/^## /m).slice(1);
  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0].trim();
    if (!name) continue;
    const fields: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const match = lines[i].match(/^-\s+\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        fields[match[1]] = match[2].trim();
      }
    }
    characters.push({ name, fields });
  }
  return characters;
}

const ROLE_COLORS: Record<string, string> = {
  "主角": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "反派": "bg-red-500/15 text-red-600 dark:text-red-400",
  "盟友": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "配角": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "提及": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  "protagonist": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "antagonist": "bg-red-500/15 text-red-600 dark:text-red-400",
  "ally": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "minor": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "mentioned": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
};

function getRoleColor(role: string): string {
  const lower = role.toLowerCase().trim();
  for (const [key, color] of Object.entries(ROLE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400";
}

const TIER_BADGE: Record<RoleRef["tier"], { label: string; color: string }> = {
  major: { label: "主要", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  minor: { label: "次要", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

interface UnifiedCharacter {
  readonly name: string;
  readonly tier: RoleRef["tier"] | "auto";
  readonly roleLabel: string;
  readonly personality: string;
  readonly tags: string[];
  readonly firstChapter: number;
  readonly lastChapter: number;
  readonly aliases: ReadonlyArray<string>;
  readonly hasRoleCard: boolean;
}

function RoleEntry({ role }: { readonly role: RoleRef }) {
  const openArtifact = useChatStore((s) => s.openArtifact);
  const badge = TIER_BADGE[role.tier];
  return (
    <button
      onClick={() => openArtifact(role.path)}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
    >
      <Users size={16} className="shrink-0 text-muted-foreground/60" />
      <span className="text-[15px] leading-6 font-medium text-foreground font-['SimSun','Songti_SC','STSong',serif] flex-1 truncate">
        {role.name}
      </span>
      <span className={cn("text-[12px] px-1.5 py-0.5 rounded-full shrink-0", badge.color)}>
        {badge.label}
      </span>
    </button>
  );
}

function ExpandableCharacterCard({ char, entities }: {
  readonly char: UnifiedCharacter;
  readonly entities: ReadonlyArray<EntitySummary>;
}) {
  const [expanded, setExpanded] = useState(false);

  const entity = entities.find((e) => e.name === char.name);

  return (
    <div className="rounded-lg bg-secondary/25 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
      >
        <Users size={16} className="shrink-0 text-muted-foreground/60" />
        <span className="text-[15px] leading-6 font-medium text-foreground font-['SimSun','Songti_SC','STSong',serif] flex-1 truncate">
          {char.name}
        </span>
        {char.roleLabel && (
          <span className={cn("text-[12px] px-1.5 py-0.5 rounded-full shrink-0", getRoleColor(char.roleLabel))}>
            {char.roleLabel.split("/")[0].trim()}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn("text-muted-foreground/50 transition-transform shrink-0", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 text-[13px] leading-6">
          {char.personality && (
            <div>
              <span className="text-muted-foreground/70 font-semibold">性格：</span>
              <span className="text-foreground/80">{char.personality}</span>
            </div>
          )}
          {char.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {char.tags.slice(0, 6).map((t) => (
                <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/80">
                  {t}
                </span>
              ))}
            </div>
          )}
          {(entity || char.firstChapter > 0) && (
            <div className="flex items-center gap-3 text-muted-foreground/70">
              {char.firstChapter > 0 && (
                <span className="flex items-center gap-1">
                  <CalendarCheck size={12} />
                  第{char.firstChapter}章登场
                </span>
              )}
              {char.lastChapter > char.firstChapter && (
                <span className="flex items-center gap-1">
                  <Sparkles size={12} />
                  最近第{char.lastChapter}章
                </span>
              )}
            </div>
          )}
          {char.aliases.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground/70">
              <Tag size={12} />
              <span>别名：{char.aliases.slice(0, 3).join("、")}</span>
            </div>
          )}
          {char.hasRoleCard && (
            <div className="text-[11px] text-muted-foreground/50 italic">
              已建立角色卡（点击上方角色名字打开查看）
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// (Legacy character matrix parsing removed — 统一通过角色卡 / entities.db 管理)

interface CharacterSectionProps {
  readonly bookId: string;
  readonly defaultOpen?: boolean;
}

export function CharacterSection({ bookId, defaultOpen = true }: CharacterSectionProps) {
  const [roles, setRoles] = useState<ReadonlyArray<RoleRef>>([]);
  const [entities, setEntities] = useState<ReadonlyArray<EntitySummary>>([]);
  const [legacyChars, setLegacyChars] = useState<CharacterInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchJson<{ files: ReadonlyArray<{ name: string }> }>(`/books/${bookId}/truth`)
      .then(async (data) => {
        if (cancelled) return;
        const roleRefs = data.files
          .map((f) => roleFromPath(f.name))
          .filter((r): r is RoleRef => r !== null)
          .sort((a, b) =>
            a.tier === b.tier ? a.name.localeCompare(b.name) : a.tier === "major" ? -1 : 1,
          );
        setRoles(roleRefs);
      })
      .catch(() => undefined);

    // 同时拉取 entities.db 中的角色数据 — 由写作流程自动提取
    fetchJson<{ characters: ReadonlyArray<EntitySummary> }>(
      `/books/${bookId}/entities/characters`,
    )
      .then((data) => {
        if (!cancelled) setEntities(data.characters ?? []);
      })
      .catch(() => {
        // 旧版本后端可能没有这个端点，忽略
      });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // 合并展示：roles 下的角色优先展示为角色卡，entities 作为补充
  const roleNames = new Set(roles.map((r) => r.name));
  const entityCharacters = entities
    .filter((e) => !roleNames.has(e.name))
    .slice(0, 5)
    .map((e) => ({
      name: e.name,
      tier: "auto" as const,
      roleLabel: "自动识别",
      personality: "",
      tags: [],
      firstChapter: e.firstAppearance ?? 0,
      lastChapter: e.lastAppearance ?? 0,
      aliases: e.aliases ?? [],
      hasRoleCard: false,
    }));

  const hasContent = roles.length > 0 || legacyChars.length > 0 || entityCharacters.length > 0;

  if (!hasContent) return null;

  return (
    <SidebarCard title="角色" defaultOpen={defaultOpen}>
      <div className="space-y-1.5">
        {/* Phase 5: role cards — 最高优先级 */}
        {roles.length > 0 && (
          <div className="space-y-1.5">
            {roles.map((role) => (
              <RoleEntry key={role.path} role={role} />
            ))}
          </div>
        )}

        {/* 自动识别的角色 — 写作流程从 entities.db 提取 */}
        {entityCharacters.length > 0 && (
          <div className="space-y-1.5 mt-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
              自动识别 ({entityCharacters.length})
            </div>
            {entityCharacters.map((ch) => (
              <ExpandableCharacterCard key={ch.name} char={ch} entities={entities} />
            ))}
          </div>
        )}

        {/* Legacy: character_matrix.md 解析 */}
        {legacyChars.length > 0 && (
          <div className="space-y-1.5 mt-2">
            {legacyChars.map((char) => (
              <ExpandableCharacterCard
                key={char.name}
                char={{
                  name: char.name,
                  tier: "auto",
                  roleLabel: char.fields["定位"] || char.fields["Role"] || "角色",
                  personality: char.fields["性格"] || char.fields["Personality"] || "",
                  tags: (char.fields["标签"] || char.fields["Tags"] || "")
                    .split(/[,，、]/)
                    .map((t) => t.trim())
                    .filter(Boolean),
                  firstChapter: 0,
                  lastChapter: 0,
                  aliases: [],
                  hasRoleCard: true,
                }}
                entities={entities}
              />
            ))}
          </div>
        )}
      </div>
    </SidebarCard>
  );
}
