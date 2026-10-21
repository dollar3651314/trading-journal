#!/usr/bin/env node
// 中英文文案的结构检查（研发职责 7）：两份文件的键名必须完全一致，占位符 {xxx} 也必须一致。
// PM 只改文案的值，不改键名；这里不通过时，CI 失败。
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../messages/${f}.json`, import.meta.url), 'utf8'));
const zh = load('zh');
const en = load('en');
const problems = [];
const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const k of Object.keys(zh)) if (!(k in en)) problems.push(`en.json 缺少 ${k}`);
for (const k of Object.keys(en)) if (!(k in zh)) problems.push(`zh.json 缺少 ${k}`);
for (const k of Object.keys(zh)) if (k in en && holes(zh[k]) !== holes(en[k])) problems.push(`占位符不一致：${k}（zh: ${holes(zh[k]) || '无'}；en: ${holes(en[k]) || '无'}）`);
for (const [lang, m] of [['zh', zh], ['en', en]]) for (const [k, v] of Object.entries(m)) if (!String(v).trim()) problems.push(`${lang}.json 的 ${k} 是空的`);
if (problems.length) {
  console.error(`文案检查没有通过（${problems.length} 处）：\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`文案检查通过：${Object.keys(zh).length} 个键，中英文一致`);
