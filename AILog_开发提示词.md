# AILog 开源项目开发提示词

你是一个资深全栈开源项目架构师和 AI 编程工具开发者。请帮我从零开发一个名为 **AILog** 的开源项目。

---

## 一、项目定位

AILog 是一个用于 **本地 Claude Code 和 OpenAI Codex CLI 对话历史管理、搜索、回顾、可视化分析和深度行为洞察** 的工具。

它的核心目标是：

1. 让开发者像浏览 **Git Log** 一样回顾自己与 AI 的协作历史。
2. 让开发者像使用 **数据分析仪表盘** 一样量化分析自己的提示词习惯、AI 的回答模式、工具调用行为、Token 使用情况、项目协作效率。
3. 支持对 Claude Code、Codex CLI、本地导出的 ChatGPT / OpenAI / Gemini / Anthropic 对话记录进行统一解析。
4. 所有数据默认只在本地处理，不上传服务器，强调隐私、安全和离线可用。
5. 项目应适合开源传播，README、界面和功能设计要有“开发者工具感”和“AI 时代 Git 日志”的记忆点。

参考项目包括：

- `ibadoo/llm-msg-analysis`：LLM 对话协议可视化分析工具，支持 Claude、OpenAI、Gemini 的 SSE 流、对话历史和 API 响应解析。
- `RubyRose2001/claudeInsight`：本地 Claude Code 对话历史管理与分析工具，支持 Dashboard、会话浏览、全文搜索、资产管理、会话对比、工具调用识别、Token 统计等。

但 AILog 不要只是复制它们，而是要在 **Claude Code + Codex CLI 双支持、Prompt 行为分析、AI 协作效率分析、Git 风格时间线、可导出报告** 方面做出差异化。

---

## 二、建议技术栈

请优先使用以下技术栈实现：

### 前端

- Vue 3 + TypeScript + Vite
- Pinia 状态管理
- Tailwind CSS
- Radix Vue / Headless UI
- Chart.js 或 ECharts
- Shiki 代码高亮
- markdown-it Markdown 渲染
- Monaco Editor 用于查看和编辑 prompt、规则、配置文件
- Lucide 图标库

### 后端

- Node.js + TypeScript
- Fastify 作为本地 API Server
- pnpm workspace monorepo
- 文件系统扫描为主
- 默认使用 SQLite 作为本地索引数据库，可选支持纯文件模式
- better-sqlite3 / drizzle ORM
- chokidar 监听本地会话文件变化
- zod 做数据校验
- fuse.js / minisearch 做本地全文搜索
- node-pty + xterm.js 作为可选增强，用于内嵌 Claude / Codex 终端

### 桌面化，作为后续可选项

- Tauri 优先，Electron 作为备选
- 第一版可以先做本地 Web App：`localhost:1420`

---

## 三、核心功能模块

### 1. 本地数据源扫描

AILog 需要支持自动发现和扫描以下数据源：

#### Claude Code

- 默认扫描 `~/.claude/`
- 支持用户自定义 Claude 目录
- 支持 Claude Code 的 JSONL 会话历史
- 支持项目维度分组
- 支持 session id、cwd、timestamp、model、token usage、tool_use、tool_result、user message、assistant message、system message 等字段解析

#### Codex CLI

- 默认扫描常见 Codex CLI 本地历史路径
- 如果路径不存在，允许用户手动添加目录
- 支持解析 JSON、JSONL、Markdown、纯文本等可能的历史格式
- 抽象成统一 Conversation Schema，避免和 Claude 数据结构强耦合

#### 通用导入

支持导入：

- `.json`
- `.jsonl`
- `.md`
- `.txt`
- `.zip`
- OpenAI API 响应
- Anthropic API 响应
- Gemini API 响应
- SSE 流式响应日志

导入时要自动识别 provider：

```ts
type Provider = "claude-code" | "codex-cli" | "openai" | "anthropic" | "gemini" | "unknown";
```

---

## 四、统一数据模型

请设计一套统一数据结构，用于兼容不同来源的 AI 对话历史。

至少包含：

```ts
interface AILogConversation {
  id: string;
  provider: Provider;
  projectName?: string;
  projectPath?: string;
  title?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  modelNames: string[];
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  tokenUsage?: TokenUsage;
  tags: string[];
  sourceFilePath: string;
  messages: AILogMessage[];
}

interface AILogMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool" | "error" | "event";
  providerRole?: string;
  content: string;
  rawContent?: unknown;
  createdAt?: string;
  model?: string;
  tokenUsage?: TokenUsage;
  toolCalls?: AILogToolCall[];
  attachments?: AILogAttachment[];
  metadata?: Record<string, unknown>;
}

interface AILogToolCall {
  id: string;
  name: string;
  type: "file" | "shell" | "mcp" | "web" | "edit" | "search" | "unknown";
  input?: unknown;
  output?: unknown;
  status: "success" | "error" | "pending" | "unknown";
  durationMs?: number;
  relatedFiles?: string[];
}

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
}
```

---

## 五、页面设计

### 1. Dashboard 总览页

需要展示：

- 总会话数
- 总消息数
- 用户 prompt 数
- AI 回复数
- 总 Token 用量
- 平均每次对话 Token
- 总工具调用次数
- 最常使用模型
- 最常协作项目
- 最近 7 天 / 30 天活跃趋势
- 每日对话热力图，类似 GitHub Contribution Graph
- 24 小时使用分布
- 每周使用趋势
- 项目排行榜
- Prompt 词频排行
- AI 工具调用排行
- 高成本会话排行
- 最长会话排行
- 最常失败工具调用排行
- 最近会话时间线

Dashboard 要有一种“AI 协作驾驶舱”的感觉。

---

### 2. Git Log 风格时间线

设计一个核心页面：**AILog Timeline**。

它应该像浏览 Git commit 一样浏览 AI 协作记录。

每条记录展示：

- 时间
- 项目名
- 会话标题
- provider：Claude / Codex / OpenAI / Gemini
- 模型
- 首条用户 prompt 摘要
- 消息数
- Token 数
- 工具调用数
- 文件修改数
- 标签
- 是否包含错误
- 是否包含代码生成
- 是否包含 shell 命令
- 是否包含 MCP 调用

支持筛选：

- 按项目
- 按 provider
- 按模型
- 按日期
- 按标签
- 按是否有工具调用
- 按是否修改文件
- 按 token 消耗区间
- 按关键词
- 按 prompt 类型

支持排序：

- 最新优先
- 最旧优先
- Token 最多
- 工具调用最多
- 会话最长
- 用户消息最多
- AI 回复最多

---

### 3. 会话详情页

会话详情页要像一个增强版 AI Chat Viewer。

功能包括：

- 左侧为消息目录
- 中间为完整对话
- 右侧为分析面板
- 支持 Markdown 渲染
- 支持代码高亮
- 支持折叠 system message
- 支持折叠 tool result
- 支持 tool_use 和 tool_result 配对显示
- 支持查看原始 JSON
- 支持一键复制某条 prompt
- 支持一键复制 AI 回复
- 支持导出当前会话为 Markdown / JSON / HTML
- 支持给会话添加标签
- 支持手动编辑会话标题和摘要
- 支持标记收藏
- 支持标记“高质量 prompt”
- 支持标记“失败案例”
- 支持标记“可复用方案”

右侧分析面板显示：

- 会话基础信息
- 模型列表
- Token 分布
- 用户 / AI 消息比例
- 工具调用列表
- 涉及文件列表
- 错误列表
- Prompt 关键词
- 自动摘要
- 可复用 prompt 片段
- 可能的任务 TODO
- AI 行为标签，例如“频繁读文件”“频繁改代码”“多次报错重试”“生成大量解释文本”

---

## 六、Prompt 分析功能，这是 AILog 的重点差异化

请重点实现 **Prompt Intelligence** 模块。

它分析用户输入的所有 prompt，帮助开发者理解自己的提问习惯。

### 基础分析

- 用户 prompt 总数
- 平均 prompt 长度
- 最短 prompt
- 最长 prompt
- 中位数 prompt 长度
- 中文 / 英文 / 混合语言比例
- 问句比例
- 命令式 prompt 比例
- 包含代码块的 prompt 比例
- 包含文件路径的 prompt 比例
- 包含错误日志的 prompt 比例
- 包含需求描述的 prompt 比例
- 包含“帮我”“优化”“修复”“解释”“实现”“重构”等关键词的比例

### 词频分析

对所有用户 prompt 做词频统计：

- 高频词 Top 50
- 高频短语 Top 50
- 高频动词
- 高频技术词
- 高频项目词
- 高频文件名
- 高频错误词
- 高频框架 / 库名
- 高频中文词
- 高频英文词
- 停用词过滤
- 自定义停用词列表
- 支持中英文分词

可视化：

- 词云
- 条形图
- 趋势图
- 技术关键词雷达图

### Prompt 类型分类

自动把 prompt 分类为：

```ts
type PromptIntent =
  | "bug_fix"
  | "feature_request"
  | "code_explanation"
  | "refactor"
  | "test_generation"
  | "documentation"
  | "debugging"
  | "architecture_design"
  | "code_review"
  | "learning"
  | "translation"
  | "data_analysis"
  | "devops"
  | "git_operation"
  | "other";
```

分类方法第一版可以使用规则 + 关键词，不依赖云端 LLM。

例如：

- “修复 / 报错 / bug / error / stack trace” → bug_fix
- “实现 / 添加 / 新增 / feature” → feature_request
- “解释 / 看不懂 / 原理” → code_explanation
- “重构 / 优化结构 / clean code” → refactor
- “测试 / 单测 / test / vitest / jest” → test_generation

### Prompt 质量评分

为每个用户 prompt 计算一个本地启发式评分：

```ts
interface PromptQualityScore {
  clarity: number;
  context: number;
  specificity: number;
  constraints: number;
  examples: number;
  total: number;
}
```

评分依据：

- 是否包含明确目标
- 是否包含上下文
- 是否包含技术栈
- 是否包含错误信息
- 是否包含期望输出格式
- 是否包含限制条件
- 是否包含示例
- 是否过短
- 是否过于模糊

展示：

- Prompt 质量趋势
- 高质量 prompt 榜单
- 低质量 prompt 榜单
- 用户最常缺失的信息，例如“经常没有提供错误日志”“经常没有说明技术栈”“经常没有给期望格式”

---

## 七、AI 行为分析功能

AILog 不只分析用户，也要分析 AI 的行为。

### AI 回复分析

统计：

- AI 回复总数
- 平均回复长度
- 平均代码块数量
- 解释文本 / 代码文本比例
- Markdown 标题使用频率
- 列表使用频率
- 是否经常给长篇解释
- 是否经常主动给计划
- 是否经常修改文件
- 是否经常运行命令
- 是否经常失败后重试
- 是否经常要求用户补充信息

### 工具调用分析

统计：

- 工具调用总数
- 工具调用成功率
- 工具调用失败率
- 最常用工具
- 最常失败工具
- shell 命令调用频率
- 文件读取频率
- 文件编辑频率
- 搜索调用频率
- MCP 调用频率
- 每个会话平均工具调用次数
- 工具调用耗时分布
- 工具调用链路图

### AI 协作效率分析

计算指标：

```ts
interface CollaborationMetrics {
  averageTurnsPerTask: number;
  averageToolCallsPerTask: number;
  averageTokensPerTask: number;
  firstTrySuccessRate?: number;
  errorRecoveryCount: number;
  repeatedPromptRate: number;
  longContextSessionRate: number;
}
```

展示：

- 哪些项目最消耗 AI Token
- 哪些任务类型最容易失败
- 哪些 prompt 类型最容易引发长对话
- 哪些模型在你的历史中更高效
- Claude 和 Codex 的使用对比
- 不同项目的 AI 协作成本对比

---

## 八、搜索功能

实现全局搜索，类似 `Cmd + K`。

搜索范围：

- 会话标题
- 用户 prompt
- AI 回复
- 代码块
- 工具调用输入
- 工具调用输出
- 文件路径
- 错误信息
- 标签
- 项目名
- 模型名

搜索能力：

- 关键词高亮
- 按 provider 过滤
- 按项目过滤
- 按日期过滤
- 按角色过滤：user / assistant / tool / system
- 按消息类型过滤
- 支持正则搜索
- 支持大小写敏感开关
- 支持搜索结果跳转到对应消息
- 支持保存常用搜索条件

---

## 九、会话对比功能

实现 Conversation Compare。

用户可以选择两个会话进行对比：

- 消息数量对比
- Token 消耗对比
- Prompt 长度对比
- 工具调用次数对比
- 模型对比
- 任务类型对比
- 涉及文件对比
- 错误数量对比
- 输出代码量对比
- 用户输入关键词差异
- AI 回复结构差异

可用于比较：

- 同一个任务在 Claude 和 Codex 中的表现
- 不同 prompt 写法带来的效果差异
- 不同模型的 token 成本差异
- 同一项目不同时期的 AI 协作模式变化

---

## 十、项目维度分析

每个项目单独有 Project Insight 页面。

显示：

- 项目总会话数
- 项目总 Token
- 项目主要任务类型
- 项目高频 prompt 词
- 项目高频文件路径
- 项目 AI 修改最多的文件
- 项目最常报错关键词
- 项目最常使用模型
- 项目协作时间线
- 项目 Prompt 质量趋势
- 项目任务类型分布
- 项目 Claude / Codex 使用比例
- 项目 Top 会话
- 项目可复用 prompt 库

---

## 十一、标签与收藏系统

支持用户手动和自动标签。

### 自动标签

例如：

- `bug-fix`
- `feature`
- `refactor`
- `docs`
- `test`
- `frontend`
- `backend`
- `database`
- `devops`
- `mcp`
- `shell`
- `high-token`
- `failed-session`
- `high-quality-prompt`
- `reusable`
- `code-generation`
- `architecture`

### 手动标签

用户可以：

- 给会话加标签
- 给单条 prompt 加标签
- 给 AI 回复加标签
- 收藏某条 prompt
- 收藏某段回答
- 建立自己的 Prompt Library

---

## 十二、Prompt Library

从历史中沉淀可复用 prompt。

功能：

- 收藏 prompt
- prompt 分组
- prompt 标签
- prompt 搜索
- prompt 评分
- prompt 使用次数统计
- 一键复制 prompt
- 从高质量 prompt 自动推荐加入 library
- 支持导出为 Markdown / JSON
- 支持生成 prompt 模板，例如：

```md
请帮我修复以下问题：

技术栈：
错误信息：
相关代码：
期望行为：
限制条件：
请输出：
```

---

## 十三、报告导出功能

支持生成分析报告。

### 单会话报告

导出：

- Markdown
- JSON
- HTML
- PDF，后续可选

内容包括：

- 会话摘要
- 关键 prompt
- AI 关键回答
- 工具调用摘要
- Token 使用
- 涉及文件
- 错误与重试
- 可复用经验

### 全局报告

生成：

- 本周 AI 协作报告
- 本月 AI 协作报告
- 项目 AI 使用报告
- Prompt 习惯分析报告
- Claude vs Codex 对比报告

报告示例标题：

```md
# AILog Weekly Report

本周你共与 AI 协作 43 次，主要集中在 Vue、Fastify、SQLite 三个项目。
你的最高频 prompt 词是“修复”“实现”“优化”“报错”“组件”。
Claude 更常用于架构设计，Codex 更常用于代码修改。
```

---

## 十四、隐私与安全

必须强调：

- 默认完全本地运行
- 不上传任何对话数据
- 不使用远程模型分析，除非用户主动开启
- 支持敏感信息扫描
- 支持 API Key 脱敏
- 支持路径脱敏
- 支持邮箱、Token、密钥、手机号脱敏
- 支持导出前自动脱敏
- 支持清空索引数据库
- 支持只读模式扫描源文件，避免误改 Claude / Codex 原始记录

敏感信息检测规则包括：

- OpenAI API Key
- Anthropic API Key
- GitHub Token
- JWT
- SSH Private Key
- 邮箱
- 手机号
- URL query token
- `.env` 内容

---

## 十五、设置页

设置项包括：

- Claude 数据目录
- Codex 数据目录
- 其他导入目录
- 是否开启自动扫描
- 扫描间隔
- 是否使用 SQLite 索引
- 是否启用全文搜索索引
- 是否启用敏感信息检测
- 是否启用自动标签
- 是否启用 Prompt 质量评分
- 是否启用高级 AI 分析，默认关闭
- 主题：浅色 / 深色 / 跟随系统
- 语言：中文 / 英文
- 数据导出
- 数据清空
- 备份与恢复

---

## 十六、CLI 功能

除了 Web UI，也请提供 CLI。

命令示例：

```bash
ailog scan
ailog serve
ailog stats
ailog search "修复 bug"
ailog export --format markdown
ailog report weekly
ailog doctor
```

CLI 功能：

- 扫描历史
- 重建索引
- 查看统计摘要
- 搜索会话
- 导出报告
- 检查本地路径配置
- 检查 Claude / Codex 是否可识别
- 输出 JSON 结果，方便其他工具集成

---

## 十七、API 设计

后端提供 REST API。

至少包括：

```txt
GET /api/health
GET /api/settings
POST /api/settings

POST /api/scan
GET /api/projects
GET /api/conversations
GET /api/conversations/:id
GET /api/conversations/:id/messages
POST /api/conversations/:id/tags
POST /api/conversations/:id/favorite

GET /api/search
GET /api/stats/overview
GET /api/stats/prompts
GET /api/stats/tools
GET /api/stats/models
GET /api/stats/projects
GET /api/stats/timeline

GET /api/prompts
GET /api/prompts/:id
POST /api/prompts/:id/favorite
GET /api/prompt-library
POST /api/prompt-library

POST /api/export/conversation/:id
POST /api/export/report
```

---

## 十八、项目结构

请生成如下 monorepo 结构：

```txt
ailog/
├── README.md
├── LICENSE
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── router/
│   │       ├── stores/
│   │       ├── views/
│   │       │   ├── DashboardView.vue
│   │       │   ├── TimelineView.vue
│   │       │   ├── ConversationView.vue
│   │       │   ├── SearchView.vue
│   │       │   ├── PromptInsightView.vue
│   │       │   ├── ProjectInsightView.vue
│   │       │   ├── CompareView.vue
│   │       │   ├── PromptLibraryView.vue
│   │       │   ├── ReportsView.vue
│   │       │   └── SettingsView.vue
│   │       ├── components/
│   │       └── lib/
│   └── server/
│       └── src/
│           ├── index.ts
│           ├── app.ts
│           ├── routes/
│           ├── services/
│           ├── parsers/
│           ├── analyzers/
│           ├── db/
│           └── types/
├── packages/
│   ├── core/
│   ├── parser/
│   ├── analyzer/
│   ├── shared/
│   └── cli/
└── docs/
    ├── architecture.md
    ├── data-schema.md
    ├── parser-guide.md
    └── privacy.md
```

---

## 十九、第一版 MVP 优先级

请先实现 MVP，不要一开始做太复杂。

### MVP 必须完成

1. 本地扫描 Claude Code 历史目录
2. 支持手动添加 Codex 历史目录
3. 统一解析会话数据
4. Timeline 页面
5. 会话详情页
6. Dashboard 基础统计
7. Prompt 词频分析
8. Prompt 类型分类
9. 全局搜索
10. 标签和收藏
11. Markdown / JSON 导出
12. 设置页
13. README 和开源文档

### 第二阶段

1. SQLite 索引优化
2. Prompt 质量评分
3. 项目维度分析
4. 会话对比
5. Prompt Library
6. 敏感信息检测
7. 周报 / 月报
8. Codex 解析增强
9. SSE / API 响应解析
10. 桌面版 Tauri

### 第三阶段

1. 内嵌 Claude / Codex 终端
2. Live Session
3. AI 自动摘要
4. 本地 LLM 分析
5. MCP Server 化
6. VS Code 插件
7. 浏览器扩展
8. 团队协作版，默认仍本地优先

---

## 二十、开源传播卖点

请在 README 中突出这些 slogan：

```md
# AILog

Your local AI collaboration logbook.

Browse your Claude Code and Codex history like Git commits.
Analyze your prompts like product analytics.
Keep everything local and private.
```

中文介绍：

```md
AILog 是一个本地优先的 AI 协作历史管理与分析工具。
它可以帮助你浏览、搜索、分析 Claude Code 和 Codex 的历史对话，
像看 Git 日志一样回顾 AI 协作过程，
像看数据仪表盘一样理解自己的 Prompt 习惯和 AI 行为模式。
```

README 需要包括：

- 项目截图占位
- 功能特性
- 安装方式
- 快速开始
- 支持的数据源
- 隐私说明
- 技术架构
- 路线图
- 贡献指南
- License

---

## 二十一、UI 风格要求

整体 UI 要：

- 暗色优先
- 开发者工具风格
- 类似 GitHub、Linear、Raycast、Vercel Dashboard 的质感
- 信息密度高但不混乱
- 图表清晰
- Timeline 有 Git commit log 的感觉
- 会话详情像现代 Chat UI + DevTools
- Dashboard 像数据分析产品

页面布局：

- 左侧 Sidebar
- 顶部 Command Bar
- 主内容区
- 右侧 Insight Panel
- 支持快捷键：
  - `Cmd/Ctrl + K` 搜索
  - `G then D` Dashboard
  - `G then T` Timeline
  - `G then P` Prompt Insight
  - `G then S` Settings

---

## 二十二、差异化功能重点

这个项目最值得突出的不是“又一个 Claude 历史查看器”，而是：

> **AI 协作可观测性工具。**

也就是不仅看历史，还回答这些问题：

- 我最常让 AI 做什么？
- 我的 prompt 写得清楚吗？
- 哪类 prompt 最耗 token？
- 哪类任务最容易失败？
- Claude 和 Codex 哪个更适合我？
- 哪个项目最依赖 AI？
- AI 经常在哪些文件上反复修改？
- 我有哪些高质量 prompt 可以复用？
- 我过去一个月的 AI 编程习惯发生了什么变化？

可以把 README 副标题写成：

```md
AILog is local-first observability for your AI coding workflow.
```

中文可以写成：

```md
AILog：面向 AI 编程工作流的本地优先可观测性工具。
```

---

## 二十三、请你开始实现

请按照以下步骤输出和开发：

1. 先给出完整架构设计。
2. 给出数据模型。
3. 给出解析器设计。
4. 给出数据库 schema。
5. 创建 monorepo 项目结构。
6. 实现后端扫描、解析、统计 API。
7. 实现前端 Dashboard、Timeline、Conversation Detail、Prompt Insight。
8. 实现搜索。
9. 实现导出。
10. 补充 README。
11. 每完成一个模块，确保 TypeScript 类型正确、可运行、无明显报错。
12. 尽量给出真实可运行代码，不要只写伪代码。
13. 如果某些 Claude / Codex 历史格式不确定，请设计 adapter 接口，并提供 mock parser 和可扩展 parser。
14. 所有代码应遵循本地优先、隐私优先原则。
15. 最终交付一个可以 `pnpm install && pnpm dev` 启动的项目。

