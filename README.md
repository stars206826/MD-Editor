# 个人 Markdown 编辑器 MVP

这是一个基于 Next.js 与 Supabase 的个人 Markdown 文档编辑器网站，适合你在不同系统和不同设备之间同步自己的文档。

## 功能

- 邮箱注册 / 登录
- 个人文档列表
- 新建、重命名、删除文档
- Markdown 编辑与实时预览
- 自动保存到 Supabase
- 跨设备访问同一账号的数据

## 技术栈

- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
copy .env.example .env.local
```

3. 在 Supabase 项目中填写：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. 在 Supabase SQL Editor 中执行 `supabase/schema.sql`

5. 启动开发环境

```bash
npm run dev
```

## Supabase 配置建议

- Auth 可以先启用邮箱密码登录
- 如果开启邮箱确认，注册后需要先去邮箱完成确认
- Site URL 本地开发可配置为 `http://localhost:3000`

## 数据表

项目首版只使用一张 `documents` 表，字段包括：

- `id`
- `user_id`
- `title`
- `content`
- `created_at`
- `updated_at`

## 后续可扩展方向

- 图片上传
- 标签与搜索
- 历史版本
- 分享与公开页面
- 离线优先同步
