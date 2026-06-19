# Shopify 定制宠物油画商店 — 技术方案 Spec

## Context

项目目标：构建一个 Shopify 线上商店，买家上传宠物照片、选择油画风格，后端调用 `google/nano-banana`（Gemini 2.5 Flash Image）生成对应风格的油画，买家确认后下单。

当前状态：Theme（piktura）和 App（ecommerce-pet-app）已初始化，Python 后端目录为空。

架构决策：
- 交互在 Shopify 商品详情页内完成（Theme 前端）
- 商品模式：预设商品 + 定制选项（line item properties）
- Python 独立部署为 REST API 服务
- 未来可能提供多轮对话，需预留兼容性

---

## 整体架构

```
┌────────────────────────────────────────────────────────────┐
│  Shopify Storefront (Theme: piktura)                        │
│  商品详情页: 照片上传 + 风格选择 + 预览 + 加入购物车         │
│         │ fetch /apps/api/*                                  │
│         ▼                                                    │
│  Shopify App Proxy（自动 HMAC 签名验证）                     │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│  Shopify App (ecommerce-pet-app)                            │
│  React Router v7 + Prisma + SQLite                          │
│  职责: 照片上传、任务调度、状态缓存、订单关联                  │
│         │ fetch Python API                                   │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│  Python Backend (llm/)                                      │
│  FastAPI + Replicate SDK                                    │
│  职责: 调用 nano-banana 模型生成油画图片                      │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│  Replicate: google/nano-banana                              │
│  输入: 宠物照片 + 油画风格 prompt                             │
│  输出: 生成的油画图片 URL                                    │
└────────────────────────────────────────────────────────────┘
```

### 完整购买流程

1. 买家访问商品页 → 上传宠物照片 → 选择油画风格
2. 点击"生成预览" → JS fetch → App Proxy → App /api/generate-preview
3. App 上传照片到 Shopify Files API → 调用 Python POST /api/v1/generate
4. Python 调用 Replicate nano-banana → 异步返回 job_id
5. 前端每 3 秒轮询 /api/job-status → App 转发到 Python
6. 生成完成 → Python 返回结果图 URL
7. 前端展示油画预览 → 买家确认
8. 点击"加入购物车" → line item properties 携带定制信息
9. 买家结账
10. Webhook orders/create → App 记录订单关联

---

## 一、Python Backend (llm/) 详细方案

### 1.1 项目结构

```
llm/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI 入口
│   ├── config.py                  # 配置管理
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── generate.py        # POST /api/v1/generate
│   │       └── status.py          # GET /api/v1/status/{job_id}
│   ├── services/
│   │   ├── __init__.py
│   │   ├── replicate_service.py   # Replicate API 封装
│   │   ├── s3_service.py          # AWS S3 图片上传 + CloudFront CDN
│   │   └── prompt_builder.py      # Prompt 构建
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # Pydantic 模型
│   └── core/
│       ├── __init__.py
│       └── auth.py                # API Key 验证中间件
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 1.2 API 端点

#### `POST /api/v1/generate`
```json
// Request
{
  "job_id": "clx123",
  "photo_url": "https://...",
  "style": "impressionist",
  "prompt_template": null,
  "conversation_id": null
}

// Response (立即返回)
{
  "job_id": "clx123",
  "status": "accepted"
}
```

#### `GET /api/v1/status/{job_id}`
```json
// Response
{
  "job_id": "clx123",
  "status": "completed",
  "result_url": "https://...",
  "error": null
}
```

### 1.3 Replicate 集成 (google/nano-banana)

通过 Replicate MCP 确认的模型 Schema:
- **Input:** `prompt` (string, 必填), `image_input` (string[], 参考图片 URL), `aspect_ratio`, `output_format`
- **Output:** string (URI) — 生成图片 URL

```python
import replicate

async def generate_painting(photo_url, prompt, job_id):
    output = await asyncio.to_thread(
        replicate.run, "google/nano-banana",
        input={
            "prompt": prompt,
            "image_input": [photo_url],
            "aspect_ratio": "match_input_image",
            "output_format": "jpg",
        }
    )
    return output
```

**注意:** Replicate 输出 URL 1小时后删除，必须及时下载并持久化存储到 AWS S3。

### 1.4 图片持久化存储（AWS S3 + CloudFront）

采用 **AWS S3 (us-east-1) + CloudFront Free 套餐** 作为图片持久化存储：

```
Replicate 生成完成 (美国)
  → Python 下载图片 (boto3 SDK)
  → 上传到 S3 us-east-1 (S3StorageService)
  → 返回 CloudFront CDN URL (永久有效)
  → 存入 GenerationJob.resultImageUrl
  → 写入订单 metafields 的是 CloudFront URL
```

```python
# llm/app/services/s3_service.py
import boto3

class S3StorageService:
    def __init__(self):
        self.s3 = boto3.client("s3", region_name=settings.AWS_REGION)
        self.bucket = settings.S3_BUCKET_NAME
        self.cdn_domain = settings.CLOUDFRONT_DOMAIN

    async def upload_image(self, image_bytes: bytes, key: str) -> str:
        await asyncio.to_thread(
            self.s3.put_object,
            Bucket=self.bucket, Key=key,
            Body=image_bytes, ContentType="image/jpeg",
            CacheControl="public, max-age=31536000",
        )
        return f"https://{self.cdn_domain}/{key}"
```

**S3 Bucket 结构：**
```
s3://pet-painting-images/
├── originals/{shop}/{job_id}/original.jpg     # 原始宠物照片
└── paintings/{shop}/{job_id}/painting.jpg     # AI 生成的油画
```

**选择理由：**
| 维度 | AWS S3 + CloudFront | 阿里云 OSS |
|------|---------------------|------------|
| 免费流量 | **100GB/月永久免费** | 5GB/月 (美国) |
| 美国用户性能 | CloudFront CDN 全球加速，**免费** | 需额外 CDN（收费） |
| 前期月成本 (50单/日) | **$0** | ~$0.32/月 |

### 1.5 Prompt 构建

```python
STYLE_PROMPTS = {
    "classic": "Transform this pet photo into a classic oil painting, realistic, detailed brushstrokes, museum quality",
    "impressionist": "Transform this pet photo into an impressionist oil painting, Monet-inspired, soft light",
    "modern": "Transform this pet photo into a modern abstract oil painting, bold colors, geometric shapes",
    "renaissance": "Transform this pet photo into a renaissance style oil painting, dramatic lighting, rich tones",
    "watercolor": "Transform this pet photo into a watercolor painting, soft edges, pastel colors",
    "pop-art": "Transform this pet photo into pop art style, vibrant colors, bold outlines",
}
```

### 1.5 异步处理

MVP: FastAPI BackgroundTasks + 内存 dict
生产: FastAPI → Redis Queue → Celery Worker

### 1.6 多轮对话兼容

- 模型包含 `conversation_id` 字段
- nano-banana 原生支持对话式编辑，未来可直接传递历史
- 预留 `POST /api/v1/conversations/{id}/generate` 路径

---

## 二、Shopify App (ecommerce-pet-app) 详细方案

### 2.1 新增路由

| 路由文件 | 方法 | 用途 |
|---------|------|------|
| `app/routes/api.storefront.upload.tsx` | POST | 照片上传 (App Proxy) |
| `app/routes/api.storefront.generate-preview.tsx` | POST | 触发油画生成 (App Proxy) |
| `app/routes/api.storefront.job-status.tsx` | GET | 查询生成状态 (App Proxy) |
| `app/routes/webhooks.orders.create.tsx` | POST | 订单创建 Webhook |
| `app/routes/app.orders.tsx` | GET | 管理后台：油画订单列表 |
| `app/routes/app.styles.tsx` | GET/POST | 管理后台：风格预设管理 |

### 2.2 Prisma Schema 扩展

```prisma
model GenerationJob {
  id               String   @id @default(cuid())
  shop             String
  conversationId   String?                 // 预留多轮对话
  status           String   @default("pending")
  petPhotoUrl      String
  paintingStyle    String
  promptUsed       String?
  resultImageUrl   String?
  replicateId      String?
  errorMessage     String?
  orderId          String?
  lineItemId       String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model PaintingStyle {
  id              String   @id @default(cuid())
  shop            String
  styleId         String
  name            String
  description     String?
  promptTemplate  String
  exampleImageUrl String?
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([shop, styleId])
}

model OrderRecord {
  id                  String   @id @default(cuid())
  shop                String
  shopifyOrderId      String   @unique
  shopifyOrderName    String?
  fulfillmentStatus   String   @default("pending")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### 2.3 App Proxy

- shopify.app.toml 配置 `write_app_proxy` scope + `[app_proxy]` 块
- 每个 api.storefront.* 路由调用 `authenticate.public.appProxy(request)`
- Theme 调用 `/apps/pet-painting/*` 如同本地路径

### 2.4 订单图片写入方案（双层策略）

**层① Line Item Properties** — 加购时自动携带

```html
<input type="hidden" name="properties[_pet_photo_url]" value="...">
<input type="hidden" name="properties[_preview_image_url]" value="...">
<input type="hidden" name="properties[_painting_style]" value="impressionist">
<input type="hidden" name="properties[_generation_job_id]" value="clx123">
<input type="hidden" name="properties[Painting Style]" value="Impressionist">
```

- `_` 前缀 = 购物车不显示，但完整传递到订单
- 商家 Admin 订单详情可直接看到这些属性值

**层② Order Metafields** — Webhook 触发，App 主动写入

订单创建后，App 通过 `orders/create` webhook + `metafieldsSet` mutation 写入:

```graphql
mutation {
  metafieldsSet(metafields: [
    { key: "pet_photo_url", namespace: "$app:painting", ownerId: "gid://shopify/Order/12345", type: "single_line_text_field", value: "https://..." },
    { key: "painting_result_url", namespace: "$app:painting", ownerId: "gid://shopify/Order/12345", type: "single_line_text_field", value: "https://..." },
    { key: "painting_style", namespace: "$app:painting", ownerId: "gid://shopify/Order/12345", type: "single_line_text_field", value: "impressionist" }
  ]) {
    metafields { key namespace value }
    userErrors { field message }
  }
}
```

**图片持久化:** Replicate URL 1小时过期 → Python 下载 → 上传 **AWS S3 (us-east-1)** → CloudFront CDN URL 存入订单

### 2.5 照片上传 (MVP)

App 接收文件 → 转发给 Python → Python 上传到 **S3** → 返回 CloudFront CDN URL

- 不再使用 Shopify Files API（省去 `write_files` scope）
- Python 端统一处理所有图片上传（原始照片 + 生成油画），复用 S3StorageService

### 2.6 配置更新

shopify.app.toml:
```toml
scopes = "write_products,write_metaobjects,write_metaobject_definitions,read_orders,write_orders,write_app_proxy"

[[webhooks.subscriptions]]
uri = "/webhooks/orders/create"
topics = [ "orders/create" ]
```

---

## 三、访问安全控制方案（详细设计）

### 3.0 安全全景

系统涉及 **4 个信任边界**，每个边界有独立的认证/授权机制：

```
买家浏览器          Shopify 平台          App 服务器          Python 服务器        Replicate
   │──①──────────>│           │──②─────>│          │──③───>│          │──④───>│
   Storefront      App Proxy             API Key+签名      Replicate Token
```

### 3.1 边界①：Storefront → App（Shopify App Proxy）

**认证：Shopify 内置 HMAC-SHA256 签名验证**

```typescript
// 所有 api.storefront.* 路由
const { shop, loggedInCustomerId } = await authenticate.public.appProxy(request);
// 自动完成: HMAC 签名验证 + timestamp 防重放 + shop 身份确认

// 业务层额外校验
const session = await db.session.findFirst({ where: { shop } });
if (!session) throw new Response("Unauthorized", { status: 401 });
```

### 3.2 边界②：Embedded App Admin

```typescript
// app.orders.tsx, app.styles.tsx
const { admin, session } = await authenticate.admin(request);
// JWT 验证 + Session 检查 + shop 匹配
```

### 3.3 边界③：App → Python（多层防御）

**第一层：网络隔离** — Python 不暴露公网，仅 App 可达
**第二层：API Key + HMAC 请求签名**

```python
# Python 端验证
api_key = request.headers.get("X-API-Key")          # 身份验证
timestamp = request.headers.get("X-Timestamp")       # 防重放（5分钟窗口）
signature = request.headers.get("X-Signature")       # HMAC-SHA256(timestamp.body, secret)
```

```typescript
// App 端生成签名
const signature = crypto.createHmac("sha256", PYTHON_API_KEY)
  .update(`${timestamp}.${bodyStr}`).digest("hex");
```

**第三层：速率限制** — 滑动窗口限流（60 req/min）

### 3.4 边界④：Python → Replicate

`REPLICATE_API_TOKEN` 环境变量自动认证，仅存在于 Python 服务器

### 3.5 Webhook 认证

```typescript
const { shop, topic, payload } = await authenticate.webhook(request);
// X-Shopify-Hmac-SHA256 自动验证
```

### 3.6 安全审计清单

- [ ] App Proxy 路由均调用 `authenticate.public.appProxy()`
- [ ] Admin 页面均调用 `authenticate.admin()`
- [ ] Webhook 路由均调用 `authenticate.webhook()`
- [ ] Python API Key + HMAC 签名双重验证
- [ ] Python 不暴露公网
- [ ] 所有密钥通过环境变量注入
- [ ] 上传文件有类型/大小校验
- [ ] Replicate Token 不出现在客户端代码
- [ ] Python 端有速率限制
- [ ] 日志不打印敏感信息

---

## 四、Theme (piktura) 前端方案

### 3.1 新增/修改文件

| 文件 | 类型 | 用途 |
|-----|------|------|
| `sections/product.liquid` | 修改 | 集成定制流程 |
| `snippets/pet-photo-upload.liquid` | 新增 | 照片上传组件 |
| `snippets/painting-style-selector.liquid` | 新增 | 风格选择器 |
| `snippets/painting-preview.liquid` | 新增 | 预览展示区 |
| `assets/customization.js` | 新增 | 前端交互逻辑 |

### 3.2 product.liquid 改造

```liquid
{% if product.tags contains 'custom-painting' %}
  <div class="product-customization">
    {% render 'pet-photo-upload' %}
    {% render 'painting-style-selector' %}
    <button id="generate-preview-btn" disabled>Generate Preview</button>
    {% render 'painting-preview' %}

    <input type="hidden" name="properties[_pet_photo_url]" id="prop-photo-url">
    <input type="hidden" name="properties[_painting_style]" id="prop-style">
    <input type="hidden" name="properties[_preview_image_url]" id="prop-preview-url">
    <input type="hidden" name="properties[_generation_job_id]" id="prop-job-id">
    <input type="hidden" name="properties[Painting Style]" id="prop-style-name">
  </div>
{% endif %}
```

- 条件渲染：仅 `custom-painting` 标签商品显示
- 加入购物车按钮初始 disabled，三条件满足后启用

### 3.3 Line Item Properties

- `_` 前缀 = 购物车不显示（_pet_photo_url, _painting_style 等）
- `Painting Style`（无前缀）= 购物车显示给买家
- 所有属性传递到订单，商家后台完整可见

### 3.4 customization.js 模块

- `PetPhotoUploader`: 文件验证、本地预览、上传
- `StyleSelector`: 风格卡片选择
- `PreviewGenerator`: 请求生成、轮询状态、渲染预览
- `CustomizationForm`: 协调器，管理状态和 line item properties

---

## 五、关键技术决策

| 决策 | 方案 | 理由 |
|------|------|------|
| Theme↔App 通信 | App Proxy | 无需暴露 App 域名，自动 HMAC |
| App↔Python 通信 | REST HTTP | 简单直接 |
| 图片存储 | AWS S3 (us-east-1) + CloudFront Free | 100GB/月永久免费流量，美国用户性能最优，零成本 |
| 异步处理 | 客户端轮询 (3s) | App Proxy 不支持 WebSocket |
| 认证 App↔Python | API Key + HMAC 请求签名 | 双重验证，防篡改+防重放 |
| 多轮对话兼容 | conversation_id + nano-banana 原生支持 | 未来可平滑过渡 |

---

## 六、实施任务清单

### Task 1: Python Backend 初始化
创建 FastAPI 项目、Replicate 集成、AWS S3 图片存储、API Key 认证、generate/status 端点、requirements.txt/Dockerfile/.env.example

### Task 2: App — Prisma Schema 迁移
扩展 GenerationJob/PaintingStyle/OrderRecord 模型，运行 migrate dev

### Task 3: App — API 路由
实现 upload/generate-preview/job-status 路由 + HMAC 验证

### Task 4: App — 配置更新
更新 shopify.app.toml scopes/webhooks，配置 App Proxy

### Task 5: App — Webhook 处理
实现 orders/create webhook，创建 OrderRecord

### Task 6: Theme — 定制组件开发
创建 pet-photo-upload/painting-style-selector/painting-preview snippets + customization.js

### Task 7: Theme — product.liquid 集成
改造 product.liquid，集成定制流程 + line item properties

### Task 8: Theme — 翻译和设置
更新 locales + settings_schema

### Task 9: App — 管理后台页面
实现 orders 列表和 styles 管理页

### Task 10: 端到端测试
完整流程验证：上传→风格→预览→购物车→结账

---

## 七、关键文件路径

**Theme:**
- `theme/piktura/sections/product.liquid`
- `theme/piktura/templates/product.json`
- `theme/piktura/config/settings_schema.json`
- `theme/piktura/locales/en.default.json`
- `theme/piktura/snippets/` (新增 3 个文件)
- `theme/piktura/assets/customization.js`

**App:**
- `app/ecommerce-pet-app/prisma/schema.prisma`
- `app/ecommerce-pet-app/shopify.app.toml`
- `app/ecommerce-pet-app/app/routes/` (新增 6 个路由文件)

**Python:**
- `llm/app/core/auth.py` — API Key + HMAC 签名中间件
- `llm/app/core/rate_limit.py` — 速率限制
- `app/ecommerce-pet-app/app/utils/python-client.server.ts` — Python API 客户端（签名生成）
