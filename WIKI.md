# E-Commerce 项目仓库 Wiki

## 项目概述

Shopify 定制宠物油画线上商店。买家在商品详情页上传宠物照片、选择油画风格，后端调用 AI 模型（Replicate `google/nano-banana`）生成对应风格的油画，买家确认后直跳 Shopify 结账页完成支付。

**当前状态：**
- ✅ 前端完整定制流程已通（上传→生成→动态价格→Checkout→Shopify 结账）
- ✅ App API 路由已完成（upload/generate/job-status/health/init-metafields）
- ✅ Mock 模式（`USE_REPLICATE=false`）：跳过 AI 生成，直接返回上传照片
- ⏳ Supabase 数据库暂停 → webhook/metafields 延迟验证（Line Item Properties 已可用）
- 🚀 Vercel 已部署：前端 `pet-paiting-frontend.vercel.app`，App `pet-paiting-app.vercel.app`

---

## 仓库结构

```
e-commerce/
├── frontend/                     # Next.js Headless 前端（已实现）
├── app/ecommerce-pet-app/        # Shopify App（React Router v7 + Prisma + PostgreSQL）
├── theme/piktura/                # Shopify Theme（保留，不再修改）
├── llm/                          # Python 后端（保留，不再使用）
└── WIKI.md                       # 本文件
```

**GitHub**: https://github.com/oversky86/pet-painting-zyy

---

## 两层架构

```
Next.js Frontend (frontend/)
  SSR 商品页 + 定制流程（照片上传/风格选择/预览/Checkout 直跳）
  │
  ├── Storefront API → 商品数据/购物车创建/结账跳转
  │
  └── App API (REST) → 照片上传/生成预览/任务状态
       │
       ▼
Shopify App (ecommerce-pet-app)
  React Router v7 + Prisma + PostgreSQL (Supabase)
  职责: Replicate 调用、图片搬运、Supabase 存储、Webhook + Metafields
  │
  ├── Replicate API (replicate npm) → 生成油画（异步轮询，当前 Mock 模式）
  ├── 图片搬运：Replicate 输出 → 内存下载 → Supabase Storage 上传
  ├── Supabase Storage (@supabase/supabase-js) → 原始照片 + 油画存储
  └── Webhook: orders/create → 提取定制属性 → 写入 Order Metafields
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

**路径**: `frontend/`

### 技术选型

| 技术 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | SSR/SSG、Turbopack、生态成熟 |
| Storefront 集成 | 自封装 `storefront.ts` | 直接 GraphQL 调用 Storefront API |
| 样式 | Tailwind CSS v4 | 快速开发，响应式 |
| 状态管理 | React useState + useCallback/useMemo | 轻量，React.memo 优化 |
| 部署 | Vercel (`pet-paiting-frontend`) | 与 App 统一平台 |

### 目录结构

```
frontend/
├── app/
│   ├── layout.tsx                  # 全局布局
│   ├── page.tsx                    # 首页
│   └── products/[handle]/
│       └── page.tsx                # 商品详情页（集成定制流程）
├── components/
│   ├── ProductCustomizer.tsx       # 定制流程核心（协调上传/生成/结账）
│   ├── PetPhotoUpload.tsx          # 照片上传（拖拽+Canvas 压缩）
│   ├── PaintingStyleSelector.tsx   # 风格选择
│   ├── PaintingPreview.tsx         # 预览展示
│   ├── SelectionsPanel.tsx         # 右侧选项面板（Size/Frame/价格/Checkout）
│   ├── StepIndicator.tsx           # 步骤指示器
│   └── CheckoutModal.tsx           # 结账弹窗（当前未使用）
├── lib/
│   ├── storefront.ts              # Storefront API 封装（GraphQL + CartInput）
│   ├── app-api.ts                 # App 后端 API 客户端
│   ├── prompts.ts                 # Prompt 模板
│   └── types.ts                   # TypeScript 类型定义
├── .env.local                     # 环境变量
└── package.json
```

### 定制流程

1. 照片上传 → App API → Supabase Storage → 返回永久 URL
2. 选择油画风格（Classic Oil / Impressionist）
3. 点击 "Generate Preview" → App 生成预览（Mock 模式直接返回上传照片）
4. 前端轮询任务状态 → 完成后展示预览
5. 选择 Size + Frame → 价格动态匹配 Shopify variant
6. 点击 **Checkout** → `createCart()`（携带定制属性）→ 直跳 Shopify 结账页

---

## 2. App — ecommerce-pet-app

**路径**: `app/ecommerce-pet-app/`

Shopify 嵌入式应用 + 后端服务，基于 React Router v7 全栈框架。

### 目录结构

```
app/ecommerce-pet-app/
├── app/
│   ├── routes/
│   │   ├── api.upload.tsx              # 照片上传 → Supabase Storage
│   │   ├── api.generate-preview.tsx    # 生成预览（含 Mock 模式）
│   │   ├── api.job-status.$jobId.tsx   # 任务状态轮询
│   │   ├── api.health.tsx              # 健康检查
│   │   ├── api.init-metafields.tsx     # 创建 Order Metafield Definitions
│   │   ├── webhooks.orders.create.tsx  # 订单 Webhook → Metafields 写入
│   │   ├── webhooks.app.uninstalled.tsx
│   │   ├── webhooks.app.scopes_update.tsx
│   │   ├── app.tsx                     # 受保护布局
│   │   ├── app._index.tsx              # 管理后台首页
│   │   ├── auth.$.tsx                  # OAuth 认证
│   │   └── auth.login/                 # 登录页
│   ├── utils/
│   │   ├── replicate.server.ts         # Replicate API 封装
│   │   ├── supabase.server.ts          # Supabase Storage 封装
│   │   ├── prompts.server.ts           # Prompt 模板
│   │   ├── rate-limit.server.ts        # 速率限制
│   │   ├── cors.server.ts              # CORS 工具
│   │   └── job-store.server.ts         # Job 存储抽象（dev=内存, prod=Prisma）
│   ├── shopify.server.ts              # Shopify App 初始化
│   ├── db.server.ts                   # Prisma 客户端单例
│   └── entry.server.tsx               # SSR 入口
├── prisma/
│   └── schema.prisma                  # 数据库模型
├── shopify.app.toml                   # App 配置
├── react-router.config.ts            # Vercel preset
└── package.json
```

### 数据库模型 (Prisma)

| 模型 | 说明 | 状态 |
|------|------|------|
| Session | 商家登录会话 | ✅ 已有 |
| GenerationJob | 生成任务（状态/照片URL/结果URL） | ✅ 已实现 |
| PaintingStyle | 油画风格配置 | 已定义 |
| OrderRecord | 订单与生成任务关联 | 已定义 |

### 核心配置 (shopify.app.toml)

| 配置项 | 值 |
|--------|------|
| client_id | `8f74713e6783c3adeb81b302e8e95866` |
| embedded | true |
| application_url | `https://pet-paiting-app.vercel.app` |
| scopes | `write_products, write_metaobjects, write_metaobject_definitions, read_orders, write_orders` |
| API Version | 2026-07 |
| Webhooks | `app/uninstalled`, `app/scopes_update`, `orders/create` |

### 开发命令

```bash
# 前端
cd frontend && npm run dev           # http://localhost:3000

# App（本地开发）
cd app/ecommerce-pet-app && PORT=3001 npx react-router dev

# 部署
vercel --yes --prod                  # 部署到 Vercel
npx shopify app deploy               # 同步 App 配置到 Shopify
```

### 本地开发特殊处理

- **MemorySessionStorage**: 本地避免 Supabase IPv6 连接问题
- **内存 Job Store**: 本地用 `Map` 替代 Prisma，避免数据库依赖
- **Mock 模式**: `USE_REPLICATE=false` 跳过 AI 生成

---

## 3. 购买流程

```
1. 买家访问 Next.js 商品页 → 浏览商品（SSR + Storefront API）
2. 上传宠物照片 → App API → Supabase Storage 原始照片
3. 选择油画风格 → 点击 "Generate Preview"
4. Mock 模式：跳过 Replicate，直接返回上传照片作为结果
5. 前端轮询任务状态 → 完成后展示预览
6. 前端展示油画预览 → 右侧面板显示（动态价格匹配 Shopify variant）
7. 选择 Size + Frame → 价格实时从 Shopify variant 匹配更新
8. 点击 Checkout → createCart()（携带定制属性）→ 直跳 Shopify 原生结账页
9. Shopify 结账页收集用户信息（email/姓名/地址）并完成支付
10. Webhook orders/create → App 提取定制属性 → 写入 Order Metafields
```

---

## 4. 订单定制信息存储

### 层① Cart Line Item Properties（前端创建时传入）

| Attribute Key | 值 | 用途 |
|---|---|---|
| `original_photo_url` | 用户上传的原始照片 URL | 商家查看原始素材 |
| `painting_url` | AI 生成的油画图片 URL | 商家查看生成结果 |
| `style` | 油画风格 key | 定制风格标识 |

> 自动出现在 Shopify Admin 订单详情的 **Additional Details** 区域。

### 层② Order Metafields（Webhook 写入，namespace: `custom`）

| Metafield Key | Type | Access | 来源 |
|---|---|---|---|
| `original_photo_url` | single_line_text_field | MERCHANT_READ | cart attribute |
| `painting_url` | single_line_text_field | MERCHANT_READ | cart attribute |
| `painting_style` | single_line_text_field | MERCHANT_READ | cart attribute `style` |

> Metafield Definition 需先创建（Admin UI 或 `/api/init-metafields`），pin: true。

---

## 5. AI 模型 — google/nano-banana

通过 Replicate API 调用，当前使用 **Mock 模式**（`USE_REPLICATE=false`）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 图片描述文本 |
| `image_input` | string[] | 否 | 参考图片 URL 数组 |
| `aspect_ratio` | enum | 否 | match_input_image, 1:1, 2:3, 3:2... |
| `output_format` | enum | 否 | jpg, png |

**Output**: string (URI) — 生成图片 URL，1小时后过期，需及时搬运到 Supabase Storage。

---

## 6. 图片持久化存储（Supabase Storage）

```
上传/生成完成
  → 上传到 Supabase Storage "paintings" bucket (public)
  → 返回永久公开 URL

Bucket 结构:
paintings/ (public)
├── originals/{shop}/{job_id}/original.jpg
└── paintings/{shop}/{job_id}/painting.jpg
```

---

## 7. 环境变量

### Frontend (.env.local)

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SHOP_DOMAIN` | Shopify 店铺域名 |
| `NEXT_PUBLIC_STOREFRONT_TOKEN` | Storefront API 公开 token |
| `NEXT_PUBLIC_APP_URL` | App API 地址（本地: `http://localhost:3001`，生产: Vercel URL） |

### App (Vercel / .env)

| 变量 | 说明 |
|------|------|
| `SHOPIFY_API_KEY` | Shopify App API Key |
| `SHOPIFY_API_SECRET` | Shopify App API Secret |
| `SHOPIFY_APP_URL` | App 公网 URL (`https://pet-paiting-app.vercel.app`) |
| `SCOPES` | `write_products,write_metaobjects,write_metaobject_definitions,read_orders,write_orders` |
| `DATABASE_URL` | Supabase PgBouncer pooler（**端口 6543**，含 `pgbouncer=true`） |
| `DIRECT_URL` | Supabase 直连（端口 5432） |
| `REPLICATE_API_TOKEN` | Replicate API Token |
| `REPLICATE_MODEL_VERSION` | nano-banana 模型版本 hash |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | Supabase 服务端密钥（RLS 绕过） |
| `RATE_LIMIT_MAX` | 每分钟最大请求数（默认 60） |
| `RATE_LIMIT_WINDOW` | 限流窗口秒数（默认 60） |

---

## 8. 关键技术决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 前端 | Next.js 16 (Headless) | SSR/SSG、Turbopack、灵活部署 |
| Storefront 集成 | 自封装 GraphQL | 直接调用 Storefront API，CartInput 包装 |
| 后端 | Shopify App (TypeScript) | 单服务，无 Python/Lambda 层 |
| Replicate 调用 | predictions.create() + 轮询 | 异步创建，前端轮询检查状态 |
| 图片搬运 | App 内存下载 → Supabase 上传 | 无 Lambda，架构最简 |
| 图片存储 | Supabase Storage | 简单、永久 URL、免费额度够用 |
| 数据库 | PostgreSQL (Supabase) | 生产级，Prisma ORM |
| 结账流程 | 直跳 Shopify 原生结账页 | 无弹窗，用户信息由 Shopify 收集 |
| 订单图片 | Line Item Properties + Order Metafields | 双层保障 |
| 商品模式 | 预设商品 + line item properties | Shopify 标准方案 |
| 本地开发 | MemorySessionStorage + 内存 JobStore | 避免 Supabase IPv6 连接问题 |

---

## 9. 前端性能 & SEO & 可访问性规范

详见技术方案 Spec 完整检查清单。核心要求：

| 类别 | 核心规范 |
|------|---------|
| React | React.memo + useCallback/useMemo，禁止内联，useEffect 清理 |
| Next.js | next/image、next/font（swap）、dynamic 懒加载、ISR |
| SEO | 语义化 HTML、Schema.org JSON-LD、SSR 关键内容、sitemap/robots |
| 可访问性 | aria-live 状态播报、键盘导航、焦点管理、对比度 ≥ 4.5:1 |
| Core Web Vitals | LCP<2.5s, CLS<0.1, INP<200ms |

---

## 10. 实施任务清单

| Task | 模块 | 内容 | 状态 |
|------|------|------|------|
| 1 | Frontend | Next.js 初始化 + 商品页 + 定制组件 | ✅ 完成 |
| 2 | App | Prisma Schema（Session/GenerationJob/PaintingStyle/OrderRecord） | ✅ 完成 |
| 3 | App | Supabase Storage 集成 | ✅ 完成 |
| 4 | App | Replicate 集成（当前 Mock 模式） | ✅ 完成 |
| 5 | App | API 路由（upload/generate/job-status + 图片搬运） | ✅ 完成 |
| 6 | App | 配置更新（scopes + webhooks + CORS + toml URL） | ✅ 完成 |
| 7 | App | Webhook（orders/create + Metafields 写入） | ⏳ 代码完成，待 Supabase 恢复后验证 |
| 8 | Frontend | 定制组件（PhotoUpload/StyleSelector/Preview/Customizer） | ✅ 完成 |
| 9 | Frontend | 商品页集成（定制流程 + 动态价格 + Checkout 直跳） | ✅ 完成 |
| 10 | App | 管理后台页面（orders 列表 + styles 管理） | 待实施 |
| 11 | 全部 | 端到端测试 | ⏳ 部分完成（webhook 待验证） |

---

## 11. 已知问题与待办

### 阻塞问题
- **Supabase 数据库暂停** → webhook 认证和 metafields 写入无法执行

### 降级方案（当前可用）
- Line Item Properties 已写入订单（Admin 订单详情 → Additional Details 可见）
- Mock 模式跳过 AI 生成，直接返回上传照片

### Supabase 恢复后待办
1. 确认 Supabase 项目已恢复（Dashboard → Restore）
2. 运行 `npx prisma migrate deploy` 创建 session 表
3. 验证 Vercel 环境变量（DATABASE_URL 端口 6543）
4. 重新部署 Vercel App
5. 端到端测试：上传→生成→Checkout→结账→完成支付
6. 检查 Vercel 日志确认 webhook 触发 + metafields 写入成功
7. 确认 Shopify Admin 订单详情中 metafields 有值
