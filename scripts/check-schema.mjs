/**
 * 对一遍 src/types/index.ts 的字段与 supabase/schema.sql 的列。
 * 这类漂移（TS 加了字段但 SQL 忘了加）只有跑起来才会炸，值得机器查一遍。
 */
import { readFileSync } from 'fs';

const types = readFileSync('src/types/index.ts', 'utf8');
const sql = readFileSync('supabase/schema.sql', 'utf8');

// interface 名 -> 表名
const MAP = {
  Member: 'members',
  AiProject: 'ai_projects',
  Post: 'posts',
  Resource: 'resources',
  ForumPost: 'forum_posts',
  ForumComment: 'forum_comments',
  ToolLink: 'tool_links',
  Message: 'messages',
};

// TS 里是驼峰、SQL 里是下划线的少数例外
const ALIAS = { cnFriendly: 'cn_friendly' };
// 只存在于本地演示实现、刻意不进数据库的字段
const LOCAL_ONLY = new Set(['password_salt', 'password_hash', 'bootstrap_admin']);

function tsFields(name) {
  const i = types.indexOf(`export interface ${name} {`);
  if (i < 0) return null;
  const body = types.slice(i, types.indexOf('\n}', i));
  const out = [];
  for (const line of body.split('\n').slice(1)) {
    const m = line.match(/^\s{2}(\w+)\??:/);
    if (m) out.push(m[1]);
  }
  return out;
}

function sqlColumns(table) {
  const i = sql.indexOf(`create table if not exists public.${table} (`);
  if (i < 0) return null;
  const body = sql.slice(i, sql.indexOf('\n);', i));
  const out = [];
  for (const line of body.split('\n').slice(1)) {
    const m = line.match(/^\s{2}(\w+)\s+\S/);
    if (m && !['check', 'primary', 'unique', 'foreign'].includes(m[1])) out.push(m[1]);
  }
  return out;
}

let problems = 0;
for (const [iface, table] of Object.entries(MAP)) {
  const f = tsFields(iface);
  const c = sqlColumns(table);
  if (!f) { console.log(`?? 找不到 interface ${iface}`); problems++; continue; }
  if (!c) { console.log(`?? 找不到表 ${table}`); problems++; continue; }
  const cols = new Set(c);
  const missing = f
    .map(x => ALIAS[x] ?? x)
    .filter(x => !cols.has(x) && !LOCAL_ONLY.has(x));
  const extra = c.filter(x => {
    const back = Object.entries(ALIAS).find(([, v]) => v === x)?.[0] ?? x;
    return !f.includes(back) && !f.includes(x);
  });
  const tag = missing.length || extra.length ? '✗' : '✓';
  if (missing.length || extra.length) problems++;
  console.log(
    `${tag} ${iface.padEnd(13)} -> ${table.padEnd(15)}` +
      (missing.length ? ` 缺列: ${missing.join(', ')}` : '') +
      (extra.length ? ` 多列: ${extra.join(', ')}` : '')
  );
}
console.log(problems === 0 ? '\n全部对齐' : `\n${problems} 处不一致`);
