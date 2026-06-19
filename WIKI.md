# E-Commerce 项目仓库 Wiki

## 项目概述

Shopify 定制宠物油画线上商店。买家在商品详情页上传宠物照片、选择油画风格，后端调用 AI 模型（Replicate `google/nano-banana`）生成对应风格的油画，买家确认预览后下单。

---

## 仓库结构

```
e-commerce/
├── frontend/                     # Next.js Headless 前端（待实现）
├── app/ecommerce-pet-app/        # Shopify App（React Router v7 + Prisma + Supabase）
├── theme/piktura/                # Shopify Theme（保留，不再修改）
├── llm/                          # Python 后端（保留，不再使用）
└── plan-shopify-pet-oil-painting.md  # 技术方案 Spec
```

---

## 两层架构

```
Next.js Frontend (frontend/)
  SSR 商品页 + 定制流程（照片上传/风格选择/预览/加购）
  │
  ├── Storefront API (@shopify/hydrogen-react) → 商品数据/购物车/结账
  │
  └── App API (REST) → 照片上传/生成预览/任务状态
       │
       ▼
Shopify App (ecommerce-pet-app)
  React Router v7 + Prisma + SQLite
  职责: Replicate 调用、图片搬运、Supabase 存储、订单关联
  │
  ├── Replicate API (replicate npm) → 生成油画图片（异步轮询）
  ├── 图片搬运：Replicate 输出 → 内存下载 → Supabase Storage 上传
  ├── Supabase Storage (@supabase/supabase-js) → 原始照片 + 油画存储
  └── Webhook: orders/create → 订单关联
```

### 信任边界与安全

| 边界 | 认证方式 |
|------|---------|
| Frontend → Storefront API | Storefront Access Token（公开，scope 受限） |
| Frontend → App API | CORS + 速率限制 |
| App → Replicate | API Token（环境变量，仅服务端） |
| App → Supabase | Service Key（环境变量，仅服务端） |
| Embedded Admin | JWT Session (`authenticate.admin()`) |
| Webhook | HMAC 验证 (`authenticate.webhook()`) |

---

## 1. Frontend — Next.js Headless

**路径**: `frontend/`（待实现）

### 技术选型

| 技术 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | SSR/SSG、生态成熟 |
| Storefront 集成 | `@shopify/hydrogen-react` | 封装 Storefront API Client，类型安全 |
| 样式 | Tailwind CSS | 快速开发，响应式 |
| 状态管理 | React useState + useReducer | 轻量，无需外部库 |
| 部署 | Vercel 或自托管 | 灵活选择 |

### 计划结构

```
frontend/
├── app/
│   ├── layout.tsx                  # 全局布局（Header/Footer/导航）
│   ├── page.tsx                    # 首页（商品列表）
│   ├── products/
│   │   └── [handle]/
│   │       └── page.tsx            # 商品详情页（集成定制流程）
│   └── cart/
│       └── page.tsx                # 购物车页
├── components/
│   ├── PetPhotoUpload.tsx          # 照片上传（拖拽+验证）
│   ├── PaintingStyleSelector.tsx   # 风格选择卡片网格
│   ├── PaintingPreview.tsx         # 预览展示（对比视图）
│   ├── ProductCustomizer.tsx       # 定制流程协调器
│   └── ui/                         # 通用 UI 组件
├── lib/
│   ├── storefront.ts              # Shopify Storefront API 封装
│   ├── app-api.ts                 # 调用 App 后端 API
│   ├── prompts.ts                 # Prompt 模板（前后端共享）
│   └── types.ts                   # TypeScript 类型定义
├── .env.local                     # 环境变量
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### 定制流程

1. 照片上传 → App API 上传 → Supabase Storage
2. 选择油画风格
3. 点击"生成预览" → App 调用 Replicate → 返回 job_id
4. 前端每 3 秒轮询 → App 检查 Replicate 状态 → 完成后下载+上传 Supabase
5. 展示油画预览 → 买家确认
6. 加入购物车 → Storefront API Cart（line item properties）

---

## 2. App — ecommerce-pet-app

**路径**: `app/ecommerce-pet-app/`

Shopify 嵌入式应用，基于 React Router v7 (Remix) 全栈框架。同时承担后端服务角色（Replicate 调用、Supabase 存储、图片搬运）。

### 目录结构

```
app/ecommerce-pet-app/
├── app/
│   ├── routes/                    # 文件系统路由
│   │   ├── app.tsx                # 受保护布局（authenticate.admin）
│   │   ├── app._index.tsx         # 管理后台首页
│   │   ├── app.additional.tsx     # 附加页面
│   │   ├── api.upload.tsx         # 照片上传（新增）
│   │   ├── api.generate-preview.tsx  # 生成预览（新增）
│   │   ├── api.job-status.$jobId.tsx # 任务状态查询（新增）
│   │   ├── webhooks.orders.create.tsx # 订单 Webhook（新增）
│   │   ├── auth.$.tsx             # OAuth 认证路由
│   │   ├── auth.login/            # 登录页
│   │   ├── _index/                # 根路由
│   │   ├── webhooks.app.uninstalled.tsx
│   │   └── webhooks.app.scopes_update.tsx
│   ├── utils/
│   │   ├── replicate.server.ts    # Replicate API 封装（新增）
│   │   ├── supabase.server.ts     # Supabase Storage 封装（新增）
│   │   ├── prompts.server.ts      # Prompt 模板（新增）
│   │   └── rate-limit.server.ts   # 速率限制（新增）
│   ├── shopify.server.ts          # Shopify App 初始化（核心）
│   ├── db.server.ts               # Prisma 客户端单例
│   ├── entry.server.tsx           # SSR 入口
│   ├── root.tsx                   # React 根布局
│   └── routes.ts                  # 路由定义（flatRoutes）
├── prisma/
│   ├── schema.prisma              # 数据库模型
│   └── migrations/                # 迁移文件
├── shopify.app.toml               # App 配置（核心）
├── vite.config.ts                 # Vite 构建配置
├── Dockerfile                     # Docker 多阶段构建
├── package.json                   # 依赖和脚本
└── tsconfig.json                  # TypeScript 配置
```

### 核心文件

#### shopify.server.ts — Shopify 集成入口

```typescript
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL,
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
});

// 导出认证方法
export const authenticate = shopify.authenticate;  // .admin() / .webhook()
export const unauthenticated = shopify.unauthenticated;
```

#### 数据库模型 (Prisma)

当前 `Session` 模型（维持商家登录状态），计划扩展：

| 模型 | 说明 |
|------|------|
| Session | 已有，商家登录会话 |
| GenerationJob | 计划：生成任务（状态/照片URL/结果URL/Replicate ID） |
| PaintingStyle | 计划：油画风格配置（名称/prompt/排序） |
| OrderRecord | 计划：订单与生成任务关联 |

### App 配置 (shopify.app.toml)

| 配置项 | 当前值 |
|--------|--------|
| client_id | `8f74713e6783c3adeb81b302e8e95866` |
| embedded | true |
| scopes | `write_products, write_metaobjects, write_metaobject_definitions` |
| API Version | 2026-07 |
| Webhooks | `app/uninstalled`, `app/scopes_update` |

### 技术依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| react-router | ^7.12.0 | 全栈框架 |
| @shopify/shopify-app-react-router | ^1.1.0 | Shopify 认证集成 |
| @shopify/shopify-app-session-storage-prisma | ^9.0.0 | Prisma 会话存储 |
| @prisma/client | ^6.16.3 | 数据库 ORM |
| @shopify/app-bridge-react | ^4.2.4 | App Bridge React |
| replicate | ^1.0.0 | Replicate SDK（计划新增） |
| @supabase/supabase-js | ^2.0.0 | Supabase Storage（计划新增） |
| nanoid | ^5.0.0 | 任务 ID 生成（计划新增） |

### 开发命令

```bash
npm run dev          # shopify app dev — 启动开发环境 + 隧道
npm run build        # react-router build — 生产构建
npm run setup        # prisma generate && prisma migrate deploy — 数据库初始化
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查
```

### 编码规范

- 路由文件必须导出 `loader`（GET）和/或 `action`（POST/PUT/DELETE）
- 受保护路由在 `loader`/`action` 入口调用 `authenticate.admin(request)`
- Webhook 处理通过 `authenticate.webhook(request)` 解析，完成后返回 `new Response()`

---

## 3. Theme — Piktura（保留，不再修改）

**路径**: `theme/piktura/`

Shopify 自定义 Liquid 主题，已初始化但不再作为前端使用。架构已迁移至 Next.js Headless。

### 目录结构

```
theme/piktura/
├── layout/              # 全局布局骨架
├── templates/           # JSON 模板
├── sections/            # 模块化内容区块
├── blocks/              # 细粒度嵌套组件
├── snippets/            # 可复用 UI 片段
├── assets/              # 静态资源
├── config/              # 主题设置
├── locales/             # 翻译文件
└── AGENTS.md            # 主题架构开发指南
```

---

## 4. AI 模型 — google/nano-banana

通过 Replicate API 调用，从 Shopify App（TypeScript）直接调用。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 图片描述文本 |
| `image_input` | string[] | 否 | 参考图片 URL 数组 |
| `aspect_ratio` | enum | 否 | match_input_image, 1:1, 2:3, 3:2... |
| `output_format` | enum | 否 | jpg, png |

**Output**: string (URI) — 生成的图片 URL，**1小时后自动删除**，需及时搬运到 Supabase Storage。

### 调用方式

```ts
// 异步创建 prediction（不阻塞）
const prediction = await replicate.predictions.create({
  version: "<nano-banana-version>",
  input: { prompt, image_input: [photoUrl], aspect_ratio: "match_input_image", output_format: "jpg" },
});

// 轮询状态
const result = await replicate.predictions.get(prediction.id);
// result.status: "starting" | "processing" | "succeeded" | "failed"
// result.output: "https://replicate.delivery/..."（成功时）
```

---

## 5. 图片持久化存储（Supabase Storage）

采用 **Supabase Storage** 作为图片持久化存储：

```
Replicate 生成完成 (美国)
  → App 轮询发现完成 → fetch 下载图片到内存
  → 上传到 Supabase Storage "paintings" bucket
  → 返回永久公开 URL
```

**Supabase Bucket 结构：**
```
paintings/ (public)
├── originals/{shop}/{job_id}/original.jpg     # 原始宠物照片
└── paintings/{shop}/{job_id}/painting.jpg     # AI 生成的油画
```

### 免费额度评估

| 资源 | 免费额度 | 升级 Pro ($25/月) |
|------|---------|-------------------|
| 存储 | 1 GB | 100 GB |
| 带宽 | 5 GB/月 | 250 GB/月 |
| 数据库 | 500 MB | 8 GB |

**结论**：前期验证阶段（<10 单/天）免费额度够用；规模化后升级 Pro（$25/月）。

---

## 6. 购买流程

```
1. 买家访问 Next.js 商品页 → 浏览商品（SSR + Storefront API）
2. 上传宠物照片 → App API 上传 → Supabase Storage
3. 选择油画风格 → 点击 "Generate Preview"
4. App 调用 Replicate predictions.create() → 返回 job_id
5. 前端每 3 秒轮询 → App 调 predictions.get() 检查状态
6. Replicate 完成 → App 下载输出到内存 → 上传 Supabase Storage
7. 返回 Supabase 永久 URL
8. 前端展示油画预览 → 买家确认
9. 加入购物车 → Storefront API Cart（line item properties）
10. 结账 → Shopify 原生结账页
11. Webhook orders/create → App 记录订单关联
```

---

## 7. 订单图片写入方案

采用 **双层策略** 确保图片信息完整写入订单：

### 层① Line Item Properties（加购时自动携带）

| 属性 | 购物车可见 | 说明 |
|------|-----------|------|
| `_pet_photo_url` | 否 | 原始宠物照片 URL（Supabase） |
| `_preview_image_url` | 否 | 生成的油画图片 URL（Supabase） |
| `_painting_style` | 否 | 油画风格 ID |
| `_generation_job_id` | 否 | 生成任务 ID |
| `Painting Style` | 是 | 风格名称（买家可见） |

### 层② Order Metafields（Webhook 触发写入）

通过 `metafieldsSet` mutation 写入，namespace `$app:painting`：

| Key | 说明 |
|-----|------|
| `pet_photo_url` | 原始照片 Supabase URL |
| `painting_result_url` | 油画结果 Supabase URL |
| `painting_style` | 风格 ID |
| `generation_job_id` | 生成任务 ID |

---

## 8. 环境变量

### Frontend (.env.local)

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SHOP_DOMAIN` | Shopify 店铺域名 |
| `NEXT_PUBLIC_STOREFRONT_TOKEN` | Storefront API 公开 token |
| `NEXT_PUBLIC_APP_URL` | App 公网 URL |

### App (.env)

| 变量 | 说明 |
|------|------|
| `SHOPIFY_API_KEY` | Shopify CLI 自动注入 |
| `SHOPIFY_API_SECRET` | Shopify CLI 自动注入 |
| `SHOPIFY_APP_URL` | Shopify CLI 自动注入 |
| `SCOPES` | `write_products,write_metaobjects,write_metaobject_definitions,read_orders,write_orders` |
| `DATABASE_URL` | `file:dev.sqlite`（MVP） |
| `REPLICATE_API_TOKEN` | Replicate API Token |
| `REPLICATE_MODEL_VERSION` | nano-banana 模型版本 hash |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥 |
| `RATE_LIMIT_MAX` | 每分钟最大请求数（默认 60） |
| `RATE_LIMIT_WINDOW` | 限流窗口秒数（默认 60） |

---

## 9. 关键技术决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 前端 | Next.js 15 (Headless) | SSR/SSG、Storefront API、灵活部署 |
| Storefront 集成 | @shopify/hydrogen-react | 封装 Storefront Client，类型安全 |
| 后端 | Shopify App (TypeScript) | 单服务，无 Python/Lambda 层 |
| Replicate 调用 | predictions.create() + 轮询 | 异步创建，前端轮询时检查状态 |
| 图片搬运 | App 内存下载 → Supabase 上传 | 无 Lambda，架构最简 |
| 图片存储 | Supabase Storage | 简单、永久 URL、MVP 阶段够用 |
| 异步通知 | 客户端轮询 (3s) | 简单可靠 |
| 数据库 MVP | SQLite (Prisma) | 开箱即用 |
| 商品模式 | 预设商品 + line item properties | Shopify 标准方案 |

---

## 10. 前端性能 & SEO & 可访问性规范（最高优先级）

每次输出代码必须满足以下规范。详见技术方案 Spec 第十章完整检查清单。

### 性能核心

| 类别 | 规范 |
|------|------|
| React | React.memo + useCallback/useMemo，禁止 JSX 内联，useEffect 清理 |
| Next.js | next/image（替代 img）、next/font（display:swap）、next/dynamic 懒加载、ISR revalidate |
| 网络 | preconnect Shopify CDN/Supabase/Replicate、Link prefetch、非首屏延迟加载 |
| 上传专项 | Canvas 压缩 ≤ 2MB、FileReader 即时预览、Web Worker 处理、轮询指数退避 |
| 包体积 | @next/bundle-analyzer，首屏 JS < 200KB gzip，afterInteractive 加载第三方脚本 |

### SEO 核心

| 类别 | 规范 |
|------|------|
| 页面级 | 语义化 HTML、generateMetadata(title/og/twitter/canonical)、唯一 h1、SSR 关键内容 |
| Schema.org | Product + BreadcrumbList + Organization JSON-LD |
| 站点级 | sitemap.ts 自动生成、robots.ts 屏蔽 API、语义化 404 |
| 图片 | alt 有语义、next/image 自动宽高（防 CLS） |

### 可访问性核心

| 规范 | 实现 |
|------|------|
| Skip navigation | `sr-only focus:not-sr-only` 跳转链接 |
| 状态播报 | aria-live="polite" 生成进度 |
| 键盘导航 | Tab/Enter/Escape 操作所有交互元素 |
| 焦点管理 | dialog 焦点锁定，关闭返回触发元素 |
| 对比度 | ≥ 4.5:1 (WCAG AA) |

### Core Web Vitals 目标

| LCP < 2.5s | CLS < 0.1 | INP < 200ms | TTFB < 800ms | FCP < 1.8s |
|------------|-----------|-------------|--------------|------------|
| SSR + priority 图 + preconnect | next/image + font swap + 占位 | Worker + 退避 + 事件委托 | Edge + ISR | 关键 CSS + 字体 preload |

---

## 11. 实施任务清单

| Task | 模块 | 内容 | 状态 |
|------|------|------|------|
| 1 | Frontend | Next.js 15 初始化（App Router + Tailwind + Storefront API） | 待实施 |
| 2 | App | Prisma Schema 迁移（GenerationJob/PaintingStyle/OrderRecord） | 待实施 |
| 3 | App | Supabase Storage 集成（上传/检查） | 待实施 |
| 4 | App | Replicate 集成（create/get/download） | 待实施 |
| 5 | App | API 路由（upload/generate-preview/job-status + 图片搬运） | 待实施 |
| 6 | App | 配置更新（scopes + webhooks + CORS） | 待实施 |
| 7 | App | Webhook 处理（orders/create + OrderRecord） | 待实施 |
| 8 | Frontend | 定制组件（PhotoUpload/StyleSelector/Preview/Customizer） | 待实施 |
| 9 | Frontend | 商品页集成（定制流程 + Storefront Cart API） | 待实施 |
| 10 | App | 管理后台页面（orders 列表 + styles 管理） | 待实施 |
| 11 | 全部 | 端到端测试（上传→风格→预览→购物车→结账→订单关联） | 待实施 |

---

## 12. MCP 工具约束（最高优先级）

本项目涉及 Replicate 和 Shopify 的开发工作，**必须优先使用以下 MCP 工具**获取准确信息：

- **Shopify MCP**: 查询 Shopify API（GraphQL Admin API, Storefront API, metafields, webhooks 等）
- **Replicate MCP**: 查询 Replicate 模型信息、Input/Output schema、API 调用方式

禁止凭记忆或猜测编写 Shopify API 或 Replicate 模型参数。
