# 后端配置

## 部署条件

* 拥有一个 Cloudflare 账号（使用邮箱即可注册，[官网地址](https://www.cloudflare.com/)）
* 拥有一个 Node.js 运行环境，版本 >= 22（本地部署需要）
* 拥有一个域名并托管在 Cloudflare 上（这个不是必须项，但可以提高国内访问速度，也更方便）

后端项目目录为 `/cwd-api`，基于 Cloudflare Workers + D1 + KV 实现。

## 自部署

**以下部署指令均在该目录下执行，不在根目录下**

fork 项目后，进入 `/cwd-api` 目录，执行以下命令安装依赖：

```
cd cwd-api
```

### 本地部署

#### 1. 下载代码，安装依赖

可以直接克隆仓库代码

```
npm install
```

#### 2. 配置 Cloudflare Workers

对于 D1 和 KV 配置，有两种方法，第一种是直接使用命令行配置，第二种是使用网页面板创建后填写配置文件，这里推荐使用第一种方法。如果想要使用之前 Cloudflare 上面已经创建的数据库，可以选择自行配置 `wrangler.jsonc` 文件。

下面介绍第一种方法。

* **登录到 Cloudflare**
  ```bash
  npx wrangler login
  ```

* **创建数据库和数据库表**，如果遇到提示，请按回车继续

  ```bash
  npx wrangler d1 create CWD_DB
  npx wrangler d1 execute CWD_DB --remote --file=./schemas/comment.sql
  ```

  运行完成后可以确认一下 `wrangler.jsonc` 中是否有如下配置
  
  ```jsonc
  "d1_databases": [
    {
      "binding": "CWD_DB",
      "database_name": "CWD_DB",
      "database_id": "xxxxxx" // D1 数据库 ID
    }
  ]
  ```

  如果 `binding` 字段不是 `CWD_DB`，请修改为 `CWD_DB`。

* **创建 KV 存储**，如果遇到提示，按回车继续

  ```bash
  npx wrangler kv namespace create CWD_AUTH_KV
  ```

  运行完成后可以确认一下 `wrangler.jsonc` 中是否有如下配置

  ```jsonc
  "kv_namespaces": [
    {
      "binding": "CWD_AUTH_KV",
      "id": "xxxxxxx" // KV 存储 ID
    }
  ]
  ```

* **部署上线**

  ```bash
  npm run deploy
  ```

没有异常报错后，可以进入 Cloudflare Workers 面板查看是否部署成功，若显示存在一个名称为 `cwd-api` 的项目即推送成功。

#### 3. 配置环境变量

* 登录 Worker 面板，点击项目右侧的 Settings (设置) 选项卡，选择 `查看设置`
* 点击变量和机密右侧的添加按钮，给项目添加环境变量，环境变量 [参考](#环境变量与绑定)
* 部署生效：点击底部的 Save and deploy (保存并部署)。

#### 4. 检测部署情况

部署成功后回得到一个域名，即为后端的域名（格式一般为`https://cwd-api.xxx.workers.dev`。访问该域名，如果显示部署成功页面，说明 API 部署成功，可以到管理后台进行登录，当然也可以使用自定义域名。

可以直接访问域名，确认是否部署成功。如果成功，则会显示 

```json
{
  "version": "0.0.0",
  "data": "成功部署 CWD 评论系统 API！文档地址 https://cwd.js.org"
}
```

## 环境变量与绑定

后端通过 Cloudflare Worker 的绑定和环境变量控制行为，类型定义见 `cwd-api/src/bindings.ts`.

所需环境变量如下表所示。

| 名称               | 类型        | 描述                                                                  |
| ------------------ | ----------- | --------------------------------------------------------------------- |
| `ADMIN_NAME`       | string      | 管理员登录名称                                                        |
| `ADMIN_PASSWORD`   | string      | 管理员登录密码                                                        |
| `TURNSTILE_SITE_KEY` | string    | Cloudflare Turnstile 站点密钥，配置后由公开配置接口下发                |
| `TURNSTILE_SECRET_KEY` | string  | Cloudflare Turnstile 私密密钥；配置后提交评论必须通过验证码            |
| `TURNSTILE_ALLOWED_HOSTNAMES` | string | 可选，允许的验证码域名，多个域名以逗号分隔                  |

在 Cloudflare 控制台中配置方式：

- 打开 Worker 项目 -> `Settings` -> `Variables`
- 在 `Environment Variables` 中添加 `ADMIN_NAME`、`ADMIN_PASSWORD` 等变量
- 在 `D1 Databases` 中绑定 `CWD_DB`（默认已配置好）
- 在 `KV Namespaces` 中绑定 `CWD_AUTH_KV`（默认已配置好）

Turnstile 私密密钥建议通过 Wrangler Secret 保存：

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

`TURNSTILE_SITE_KEY` 和可选的 `TURNSTILE_ALLOWED_HOSTNAMES` 可以作为普通 Worker 变量配置。只有同时配置私密密钥和站点密钥时，前端才会显示验证码。服务端在检测到私密密钥后会强制校验 Turnstile token、`action=comment` 和可选的允许域名，因此不要只配置私密密钥，否则前端无法取得站点密钥，评论请求会被拒绝。


## 参考模板

一份完整的参考模板，如遇到部署问题可以对照参数进行检查。

```jsonc
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "cwd-api",
	"main": "src/index.ts",
	"compatibility_date": "2026-01-03",
	"compatibility_flags": [
		"nodejs_compat"
	],
	"workers_dev": true,
	"preview_urls": true,
	"send_email": [
		{
			"name": "SEND_EMAIL"
		}
	],
	"d1_databases": [
		{
			"binding": "CWD_DB",
			"database_name": "CWD_DB",
			"database_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
			"remote": true
		}
	],
	"kv_namespaces": [
		{
			"binding": "CWD_AUTH_KV",
			"id": "xxxxxxxxxxxxxxxxxxxxxxx"
		}
	],
	"vars": {
		"ADMIN_NAME": "admin@example.com",
		"ADMIN_PASSWORD": "123456",
		"TURNSTILE_SITE_KEY": "0x4AAAAAAA...",
		"TURNSTILE_ALLOWED_HOSTNAMES": "example.com,www.example.com"
	}
}
```