/**
 * 实体类型定义
 * 支持 6 类实体：角色、关系、场景、组织、物品、概念
 */

export type EntityType = 'character' | 'relationship' | 'scene' | 'organization' | 'item' | 'concept';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];                    // 别名
  attributes: Record<string, any>;      // 静态属性
  state: Record<string, any>;           // 动态状态
  firstAppearance: number;              // 首次出现章节
  lastAppearance: number;               // 最后出现章节
  status: 'active' | 'exited' | 'dead';
  exitChapter?: number;
  exitReason?: string;
  tags: string[];
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;                         // 'knows' | 'owns' | 'member_of' | 'located_at' | 'loves' | ...
  attributes: Record<string, any>;
  since: number;                        // 起始章节
  until?: number;                       // 结束章节
}

export interface EntityDelta {
  characters: Entity[];
  relationships: Edge[];
  scenes: Entity[];
  organizations: Entity[];
  items: Entity[];
  concepts: Entity[];
}

export interface StateChange {
  entityId: string;
  chapter: number;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

/**
 * 实体关系类型
 */
export const RELATIONSHIP_TYPES = {
  // 角色关系
  KNOWS: 'knows',
  LOVES: 'loves',
  ENEMY: 'enemy',
  FRIEND: 'friend',
  FAMILY: 'family',
  MENTOR: 'mentor',
  STUDENT: 'student',
  COLLEAGUE: 'colleague',
  SUPERIOR: 'superior',
  SUBORDINATE: 'subordinate',

  // 组织关系
  MEMBER_OF: 'member_of',
  LEADER_OF: 'leader_of',
  FOUNDED: 'founded',

  // 物品关系
  OWNS: 'owns',
  HOLDS: 'holds',
  USED_BY: 'used_by',
  CREATED_BY: 'created_by',

  // 场景关系
  LOCATED_AT: 'located_at',
  NEAR: 'near',
  INSIDE: 'inside',

  // 概念关系
  RELATED_TO: 'related_to',
  CONTRADICTS: 'contradicts',
  DEPENDS_ON: 'depends_on',
} as const;

export type RelationshipType = typeof RELATIONSHIP_TYPES[keyof typeof RELATIONSHIP_TYPES];

/**
 * 实体类型颜色（用于可视化）
 */
export const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  character: '#3b82f6',    // 蓝色
  scene: '#22c55e',        // 绿色
  organization: '#a855f7', // 紫色
  item: '#eab308',         // 黄色
  concept: '#6b7280',      // 灰色
  relationship: '#ef4444', // 红色
};

/**
 * 实体类型图标（用于 UI）
 */
export const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
  character: '👤',
  scene: '📍',
  organization: '🏢',
  item: '📦',
  concept: '💡',
  relationship: '🔗',
};
