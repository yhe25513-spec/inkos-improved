# InkOS 开发者指南

## 项目结构

```
inkos/
├── packages/
│   ├── core/           # 核心逻辑
│   │   └── src/
│   │       ├── compliance/     # 合规管理
│   │       ├── anti-ai/        # 去AI味
│   │       ├── emotional/      # 情感增强
│   │       ├── creativity/     # 创意原创
│   │       ├── consistency/    # 长篇连贯
│   │       ├── learning/       # 用户偏好
│   │       ├── utils/          # 工具函数
│   │       └── __tests__/      # 测试
│   ├── studio/         # Web UI
│   │   └── src/
│   │       ├── components/     # 组件
│   │       ├── pages/          # 页面
│   │       ├── hooks/          # 自定义Hook
│   │       └── store/          # 状态管理
│   └── cli/            # 命令行工具
├── prisma/             # 数据库Schema
├── docs/               # 文档
└── docker-compose.yml  # Docker配置
```

---

## 开发环境搭建

### 前置要求

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16+

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/inkos/inkos.git
cd inkos

# 2. 安装依赖
pnpm install

# 3. 启动数据库
docker-compose up -d

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 5. 运行数据库迁移
pnpm prisma migrate dev

# 6. 启动开发服务器
pnpm dev
```

---

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化

### 命名规范

- 文件名：`kebab-case.ts`
- 类名：`PascalCase`
- 函数名：`camelCase`
- 常量：`UPPER_SNAKE_CASE`

### 提交规范

使用 Conventional Commits：

```
feat: 新增功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

---

## 模块开发

### 1. 合规管理系统

**目录：** `packages/core/src/compliance/`

**添加新平台：**

1. 在 `types.ts` 中添加平台类型
2. 在 `policy-engine.ts` 中添加平台策略
3. 编写测试

```typescript
// types.ts
export type Platform = 'qidian' | 'tomato' | 'jjwxc' | 'amazon-kdp' | 'new-platform';

// policy-engine.ts
const PLATFORM_POLICIES: Record<Platform, PlatformPolicy> = {
  // ... 现有平台
  'new-platform': {
    id: 'new-platform',
    name: '新平台',
    aiDisclosureRequired: true,
    aiContentLimit: 0.4,
    bannedContent: [],
    requiredLabels: ['AI辅助创作'],
  },
};
```

### 2. 去AI味系统

**目录：** `packages/core/src/anti-ai/`

**添加新文体：**

1. 在 `genre-adapters.ts` 中添加文体配置
2. 在 `sentence-reconstructor.ts` 中添加适配逻辑

```typescript
// genre-adapters.ts
const GENRE_CONFIGS: Record<GenreType, GenreConfig> = {
  // ... 现有文体
  'new-genre': {
    replacementIntensity: 0.6,
    allowedInterjections: ['嗯', '啊'],
    characteristicWords: ['特征词1', '特征词2'],
    avoidedWords: ['避免词1'],
    sentencePreference: {
      shortSentenceRatio: 0.4,
      maxLongSentenceLength: 35,
    },
  },
};
```

### 3. 情感深度增强

**目录：** `packages/core/src/emotional/`

**添加新情感类型：**

1. 在 `types.ts` 中添加情感类型
2. 在 `emotion-analyzer.ts` 中添加情感词典
3. 在 `injector.ts` 中添加注入逻辑

```typescript
// types.ts
export type EmotionType = 'joy' | 'sadness' | 'new-emotion';

// emotion-analyzer.ts
const EMOTION_WORDS: Record<EmotionType, string[]> = {
  // ... 现有情感
  'new-emotion': ['词汇1', '词汇2', '词汇3'],
};
```

### 4. 创意原创性系统

**目录：** `packages/core/src/creativity/`

**添加新套路：**

1. 在 `trope-detector.ts` 中添加套路定义

```typescript
// trope-detector.ts
const TROPE_DATABASE: Trope[] = [
  // ... 现有套路
  {
    id: 'new-trope',
    name: '新套路',
    category: 'plot',
    description: '套路描述',
    frequency: 0.5,
    keywords: ['关键词1', '关键词2'],
    alternatives: ['替代方案1', '替代方案2'],
  },
];
```

### 5. 长篇连贯性管理

**目录：** `packages/core/src/consistency/`

**扩展现有功能：**

1. 在对应模块中添加新方法
2. 更新类型定义
3. 编写测试

### 6. 用户偏好学习

**目录：** `packages/core/src/learning/`

**添加新分析维度：**

1. 在 `types.ts` 中添加类型
2. 在 `preference-analyzer.ts` 中添加分析逻辑
3. 在 `prompt-enhancer.ts` 中添加生成逻辑

---

## 测试规范

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试
pnpm vitest run src/__tests__/anti-ai.test.ts

# 运行性能测试
pnpm vitest run src/__tests__/performance.test.ts
```

### 测试结构

```typescript
import { describe, it, expect } from 'vitest';
import { ModuleUnderTest } from '../module';

describe('ModuleUnderTest', () => {
  it('should do something', () => {
    const result = ModuleUnderTest.doSomething();
    expect(result).toBe(expectedValue);
  });

  it('should handle edge cases', () => {
    expect(() => ModuleUnderTest.doSomething(null)).toThrow();
  });
});
```

### 测试覆盖率

- 单元测试：> 80%
- 集成测试：> 70%
- 性能测试：100% 关键路径

---

## 数据库

### Schema 位置

`prisma/schema.prisma`

### 常用命令

```bash
# 生成客户端
pnpm prisma generate

# 运行迁移
pnpm prisma migrate dev

# 查看数据库
pnpm prisma studio

# 重置数据库
pnpm prisma migrate reset
```

### 新增表

1. 在 `schema.prisma` 中添加模型
2. 运行 `pnpm prisma migrate dev --name add_feature`
3. 更新相关代码

---

## 性能优化

### 缓存策略

使用 LRU 缓存高频计算结果：

```typescript
import { LRUCache } from '../utils/cache';

const cache = new LRUCache<string, Result>({
  maxSize: 1000,
  ttlMs: 5 * 60 * 1000, // 5分钟
});

function getResult(key: string): Result {
  const cached = cache.get(key);
  if (cached) return cached;

  const result = expensiveComputation(key);
  cache.set(key, result);
  return result;
}
```

### 算法优化

- 使用 Set 替代 Array 进行查找
- 避免重复计算
- 使用惰性求值

---

## 部署

### Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 生产环境配置

1. 设置环境变量
2. 配置反向代理
3. 启用HTTPS
4. 配置监控

---

## 贡献流程

1. Fork 仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

---

## 常见问题

### Q: 如何添加新的AI检测器？

A: 在 `compliance/types.ts` 中添加 `DetectorResult` 类型，然后在 `policy-engine.ts` 中集成。

### Q: 如何优化性能？

A: 使用LRU缓存、避免重复计算、使用高效的数据结构。

### Q: 如何添加新的情感类型？

A: 在 `emotional/types.ts` 中添加 `EmotionType`，然后在 `emotion-analyzer.ts` 中添加词典。

---

## 相关资源

- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Prisma 文档](https://www.prisma.io/docs)
- [React 文档](https://react.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
