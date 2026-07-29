# 评论接口

评论相关的公开接口，包括获取评论列表、提交评论、评论点赞等。

## 获取评论列表

```
GET /api/comments
```

获取指定文章的评论列表，支持分页和嵌套结构。

- 方法：`GET`
- 路径：`/api/comments`
- 鉴权：不需要

**查询参数**

| 名称        | 位置  | 类型    | 必填 | 说明                                       |
| ----------- | ----- | ------- | ---- | ------------------------------------------ |
| `post_slug` | query | string  | 是   | 文章 slug，与前端 `CWDComments` 的 `postSlug` 参数对应 |
| `siteId`    | query | string  | 否   | 站点 ID，用于多站点数据隔离，默认 `default` |
| `page`      | query | integer | 否   | 页码，默认 `1`                             |
| `limit`     | query | integer | 否   | 每页数量，默认 `20`，最大 `50`             |
| `nested`    | query | string  | 否   | 是否返回嵌套结构，默认 `'true'`            |

**成功响应**

- 状态码：`200`

```json
{
  "data": [
    {
      "id": 1,
      "author": "张三",
      "email": "zhangsan@example.com",
      "url": "https://example.com",
      "contentText": "很棒的文章！",
      "contentHtml": "很棒的文章！",
      "pubDate": "2026-01-13T10:00:00Z",
      "postSlug": "/blog/hello-world",
      "avatar": "https://gravatar.com/avatar/...",
      "priority": 2,
      "likes": 5,
      "replies": [
        {
          "id": 2,
          "author": "李四",
          "email": "lisi@example.com",
          "url": null,
          "contentText": "同感！",
          "contentHtml": "同感！",
          "pubDate": "2026-01-13T11:00:00Z",
          "postSlug": "/blog/hello-world",
          "avatar": "https://gravatar.com/avatar/...",
          "parentId": 1,
          "replyToAuthor": "张三",
          "priority": 1,
          "likes": 2
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalCount": 2
  }
}
```

返回字段说明：

| 字段名      | 类型   | 说明                       |
| ----------- | ------ | -------------------------- |
| `id`        | number | 评论 ID                    |
| `author`    | string | 评论者昵称                 |
| `email`     | string | 评论者邮箱（hash后）       |
| `url`       | string | null) | 评论者个人主页地址     |
| `contentText` | string | 评论内容（纯文本）         |
| `contentHtml` | string | 评论内容（渲染后的 HTML）   |
| `pubDate`   | string | 发布时间（ISO 8601 格式）  |
| `postSlug`  | string | 文章 slug                  |
| `avatar`    | string | 头像 URL（Gravatar）       |
| `priority`  | number | 置顶权重，数值越大排序越靠前 |
| `likes`     | number | 点赞数，默认为 0           |
| `replies`   | array  | 子评论列表（嵌套结构时）   |
| `parentId`  | number | null) | 父评论 ID（回复时）     |
| `replyToAuthor` | string( | null) | 被回复者的昵称（回复时） |

说明：

- 当 `nested=true`（默认）时，接口返回的是"根评论列表"，每条根评论包含其 `replies`。
- 当 `nested=false` 时，接口返回扁平列表，所有评论都在 `data` 中，`replies` 为空。
- `priority` 字段：评论的置顶权重，数值越大排序越靠前。
- `likes` 字段：评论的点赞数，默认为 0。

**错误响应**

- 缺少 `post_slug`：

  - 状态码：`400`

  ```json
  {
    "message": "post_slug is required"
  }
  ```

- 服务器内部错误：

  - 状态码：`500`

  ```json
  {
    "message": "错误信息"
  }
  ```

## 提交评论

```
POST /api/comments
```

提交新评论或回复。

- 方法：`POST`
- 路径：`/api/comments`
- 鉴权：不需要

**请求头**

| 名称           | 必填 | 示例                         |
| -------------- | ---- | ---------------------------- |
| `Content-Type` | 是   | `application/json`          |

**请求头**

| 名称           | 必填 | 示例                         |
| -------------- | ---- | ---------------------------- |
| `Content-Type` | 是   | `application/json`          |
| `X-Site-Id`    | 否   | `blog`                       |

**请求体（Request Body）**

```json
{
  "post_slug": "hello-world",
  "post_title": "博客标题，可选",
  "post_url": "https://example.com/blog/hello-world",
  "name": "张三",
  "email": "zhangsan@example.com",
  "url": "https://zhangsan.me",
  "content": "很棒的文章！",
  "parent_id": 1,
  "adminToken": "your-admin-key",
  "turnstileToken": "turnstile-response-token"
}
```

字段说明：

| 字段名       | 类型   | 必填 | 说明                                                                 |
| ------------ | ------ | ---- | -------------------------------------------------------------------- |
| `post_slug`  | string | 是   | 文章 slug，应与前端组件初始化时的 `postSlug` 值一致，如 `hello-world` |
| `post_title` | string | 否   | 文章标题，用于邮件通知内容                                             |
| `post_url`   | string | 否   | 文章完整 URL，用于邮件通知中的跳转链接                                  |
| `name`       | string | 是   | 评论者昵称                                                           |
| `email`      | string | 是   | 评论者邮箱，需为合法邮箱格式                                         |
| `url`        | string | 否   | 评论者个人主页或站点地址                                             |
| `content`    | string | 是   | 评论内容，内部会过滤 `<script>...</script>` 片段                     |
| `parent_id`  | number | 否   | 父评论 ID，用于回复功能；缺省或 `null` 表示根评论                    |
| `adminToken` | string | 否   | 管理员评论密钥，博主发布评论时需要先通过 `/api/verify-admin` 验证密钥后将密钥传入此字段，评论将直接通过且不受审核设置影响 |
| `turnstileToken` | string | 启用 Turnstile 时是 | Cloudflare Turnstile 返回的一次性验证 token |

**请求头说明：**

| 名称       | 必填 | 说明                       |
| ---------- | ---- | -------------------------- |
| `X-Site-Id` | 否   | 站点 ID，用于多站点数据隔离，默认 `default` |

**成功响应**

- 状态码：`200`

评论直接通过时：

```json
{
  "message": "评论已提交",
  "status": "approved"
}
```

评论进入待审核状态时（开启"先审核再显示"且非管理员评论）：

```json
{
  "message": "已提交评论，待管理员审核后显示",
  "status": "pending"
}
```

**错误响应**

- 同一 IP 在 10 秒内重复评论：

  - 状态码：`429`

  ```json
  {
    "message": "评论频繁，等10s后再试",
    "turnstileConsumed": false
  }
  ```

  `turnstileConsumed` 为 `false` 表示请求在调用 Siteverify 前已被拒绝，前端可以保留尚未消费的验证码 token。

- Turnstile 验证失败或缺少 token：

  - 状态码：`403`

  ```json
  {
    "message": "请完成人机验证后再提交评论"
  }
  ```

- 请求体缺失或字段类型错误：

  - 状态码：`400`

  ```json
  {
    "message": "无效的请求体"
  }
  ```

- 缺少必填字段：

  - `post_slug` 为空：

    ```json
    {
      "message": "post_slug 必填"
    }
    ```

  - `content` 为空：

    ```json
    {
      "message": "评论内容不能为空"
    }
    ```

  - `author` 为空：

    ```json
    {
      "message": "昵称不能为空"
    }
    ```

  - `email` 为空或格式不正确：

    ```json
    {
      "message": "邮箱不能为空"
    }
    ```

    或

    ```json
    {
      "message": "邮箱格式不正确"
    }
    ```

- IP 或邮箱被限制：

  - IP 被限制：
    - 状态码：`403`

    ```json
    {
      "message": "当前 IP 已被限制评论，请联系站长进行处理"
    }
    ```

  - 邮箱被限制：
    - 状态码：`403`

    ```json
    {
      "message": "当前邮箱已被限制评论，请联系站长进行处理"
    }
    ```

- 管理员评论验证失败：

  - 未输入密钥：
    - 状态码：`401`

    ```json
    {
      "message": "请输入管理员密钥",
      "requireAuth": true
    }
    ```

  - 密钥错误：
    - 状态码：`401`

    ```json
    {
      "message": "密钥错误"
    }
    ```

  - 验证失败次数过多：
    - 状态码：`403`

    ```json
    {
      "message": "验证失败次数过多，请 30 分钟后再试"
    }
    ```

- 评论频率限制：

  - 状态码：`429`
  - 逻辑：同一 IP 最近一条评论时间在 10 秒内，则拒绝此次请求。

  ```json
  {
    "message": "评论频繁，等 10s 后再试"
  }
  ```

- 服务器内部错误：

  - 状态码：`500`

  ```json
  {
    "message": "Internal Server Error"
  }
  ```

## 点赞评论

```
POST /api/comments/like
```

对指定评论进行点赞操作。

- 方法：`POST`
- 路径：`/api/comments/like`
- 鉴权：不需要

**请求头**

| 名称           | 必填 | 示例               |
| -------------- | ---- | ------------------ |
| `Content-Type` | 是   | `application/json` |

**请求体**

```json
{
  "id": 123
}
```

字段说明：

| 字段名 | 类型   | 必填 | 说明       |
| ------ | ------ | ---- | ---------- |
| `id`   | number | 是   | 评论 ID |

**成功响应**

- 状态码：`200`

```json
{
  "message": "点赞成功",
  "likes": 5
}
```

字段说明：

| 字段名  | 类型   | 说明           |
| ------- | ------ | -------------- |
| `likes` | number | 更新后的点赞数 |

**错误响应**

- 状态码：`400`

```json
{
  "message": "评论不存在"
}
```

## 取消点赞评论

```
DELETE /api/comments/like
```

取消对指定评论的点赞。

- 方法：`DELETE`
- 路径：`/api/comments/like`
- 鉴权：不需要

**请求头**

| 名称           | 必填 | 示例               |
| -------------- | ---- | ------------------ |
| `Content-Type` | 是   | `application/json` |

**请求体**

```json
{
  "id": 123
}
```

字段说明：

| 字段名 | 类型   | 必填 | 说明       |
| ------ | ------ | ---- | ---------- |
| `id`   | number | 是   | 评论 ID |

**成功响应**

- 状态码：`200`

```json
{
  "message": "取消点赞成功",
  "likes": 4
}
```

字段说明：

| 字段名  | 类型   | 说明           |
| ------- | ------ | -------------- |
| `likes` | number | 更新后的点赞数 |

**错误响应**

- 状态码：`400`

```json
{
  "message": "评论不存在"
}
```
