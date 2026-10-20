// Worker 入口。原型阶段只有健康检查；页面由静态资源直接返回（wrangler.jsonc 的 assets，单页应用回退到 index.html）。
// 第 1 步以后在这里加上接口（Hono）、email 和 scheduled 入口（00-架构方案 第 2 节）。
import { Hono } from 'hono';

export interface Env {
  APP_ENV: string;
  APP_VERSION: string;
}

const app = new Hono<{ Bindings: Env }>();

// 健康检查：只返回是非结果、环境和版本号，不返回任何配置值（C19、C28）。
app.get('/api/health', (c) => c.json({ ok: true, env: c.env.APP_ENV, version: c.env.APP_VERSION }));
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
