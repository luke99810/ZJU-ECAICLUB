/**
 * 成员批量导入 —— 解析 CSV / XLSX，逐行校验后交给 `addMember`。
 *
 * 设计取向：**尽量宽松地读，严格地报**。表头允许中英文多种写法（社团换届时
 * 表格是谁做的都有），但每一行的问题都要单独列出来告诉管理员，而不是整批失败或
 * 静默跳过 —— 名单是要对人负责的数据。
 *
 * 解析同样在浏览器里做（xlsx 按需 dynamic import），不上传文件。
 */
import { ADMIN_DEPARTMENT, AI_TAGS, DEPARTMENTS, type AiTag } from '../types';
import { addMember, updateMember } from './auth';
import { listMembers } from './store';

export const IMPORT_ACCEPT = '.csv,.xlsx,.xls';
export const MAX_IMPORT_ROWS = 300;

/** 表头别名 → 标准字段。全部转小写、去空格后比对。 */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['姓名', '名字', 'name', '成员姓名'],
  student_id: ['学号', 'studentid', 'student_id', 'id', '学生号'],
  email: ['邮箱', '电子邮箱', 'email', 'mail', '邮件'],
  department: ['部门', 'department', 'dept', '所属部门'],
  tags: ['标签', '技术标签', 'tags', '擅长方向'],
  interests: ['兴趣方向', '研究方向', '方向', 'interests', '兴趣'],
  joinedYear: ['加入年份', '年份', 'year', 'joinedyear', '入会年份'],
  bio: ['简介', '介绍', 'bio', '备注'],
};

function normalizeHeader(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '');
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(a => a.toLowerCase().replace(/\s+/g, '') === key)) return field;
  }
  return null;
}

/**
 * 极简 CSV 解析：支持双引号包裹、字段内逗号与转义双引号。
 * 不引入依赖 —— 成员名单这种规模不值得为它加一个 csv 库。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  // 去掉 Excel 导出常带的 BOM，否则第一个表头会匹配不上
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim()));
}

export interface ParsedRow {
  /** 表格里的行号（含表头，从 1 开始），报错时给管理员定位用。 */
  line: number;
  name: string;
  student_id: string;
  email: string;
  department: string;
  tags: AiTag[];
  interests?: string;
  joinedYear?: number;
  bio?: string;
}

export interface ParseReport {
  rows: ParsedRow[];
  /** 每条是一句人能读懂的话，直接展示。 */
  errors: string[];
  /** 识别到的表头字段，用于告诉管理员哪些列被忽略了。 */
  recognized: string[];
  ignored: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

export async function parseMemberFile(file: File): Promise<ParseReport> {
  const name = file.name.toLowerCase();
  let table: string[][];

  if (name.endsWith('.csv')) {
    table = parseCsv(await file.text());
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    // xlsx 有几百 KB，只在真的导入表格时才加载
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { rows: [], errors: ['表格里没有工作表'], recognized: [], ignored: [] };
    table = XLSX.utils
      .sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
      .map(r => r.map(c => String(c ?? '')));
    table = table.filter(r => r.some(c => c.trim()));
  } else {
    return { rows: [], errors: [`不支持 ${name} 这种格式，请用 CSV 或 XLSX`], recognized: [], ignored: [] };
  }

  if (table.length < 2) {
    return { rows: [], errors: ['文件里只有表头或完全是空的'], recognized: [], ignored: [] };
  }

  const header = table[0];
  const fieldByCol = header.map(normalizeHeader);
  const recognized = fieldByCol.filter((f): f is string => f !== null);
  const ignored = header.filter((_, i) => fieldByCol[i] === null).filter(h => h.trim());

  const errors: string[] = [];
  for (const required of ['name', 'student_id', 'email']) {
    if (!recognized.includes(required)) {
      const label = { name: '姓名', student_id: '学号', email: '邮箱' }[required];
      errors.push(`缺少必需的列「${label}」。表头可以写成：${HEADER_ALIASES[required].join(' / ')}`);
    }
  }
  if (errors.length) return { rows: [], errors, recognized, ignored };

  const body = table.slice(1);
  if (body.length > MAX_IMPORT_ROWS) {
    errors.push(`一次最多导入 ${MAX_IMPORT_ROWS} 行，当前 ${body.length} 行。请拆分后分批导入。`);
    return { rows: [], errors, recognized, ignored };
  }

  const rows: ParsedRow[] = [];
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  body.forEach((cells, i) => {
    const line = i + 2; // +1 表头 +1 从 1 开始
    const get = (field: string) => {
      const col = fieldByCol.indexOf(field);
      return col < 0 ? '' : (cells[col] ?? '').trim();
    };

    const row: ParsedRow = {
      line,
      name: get('name'),
      student_id: get('student_id'),
      email: get('email').toLowerCase(),
      department: get('department') || '技术部',
      tags: [],
      interests: get('interests') || undefined,
      bio: get('bio') || undefined,
    };

    if (!row.name || !row.student_id || !row.email) {
      errors.push(`第 ${line} 行：姓名 / 学号 / 邮箱 有空值，已跳过`);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(row.email)) {
      errors.push(`第 ${line} 行：邮箱「${row.email}」格式不对，已跳过`);
      return;
    }
    if (!(DEPARTMENTS as readonly string[]).includes(row.department)) {
      errors.push(
        `第 ${line} 行：部门「${row.department}」不在 ${DEPARTMENTS.join(' / ')} 里，已跳过`
      );
      return;
    }
    // 文件里一次导入多个管理层容易误操作，明确挡掉让人一个个加
    if (row.department === ADMIN_DEPARTMENT) {
      errors.push(`第 ${line} 行：批量导入不允许直接设为「${ADMIN_DEPARTMENT}」，请单独添加`);
      return;
    }

    const tagsRaw = get('tags');
    if (tagsRaw) {
      const picked = tagsRaw
        .split(/[,，、;；|\/\s]+/)
        .map(t => t.trim())
        .filter(Boolean);
      const unknown = picked.filter(t => !(AI_TAGS as readonly string[]).includes(t));
      row.tags = picked.filter((t): t is AiTag => (AI_TAGS as readonly string[]).includes(t));
      if (unknown.length) {
        errors.push(`第 ${line} 行：标签 ${unknown.join('、')} 不在词表里，已忽略（其余保留）`);
      }
    }

    const yearRaw = get('joinedYear');
    if (yearRaw) {
      const y = Number(yearRaw.replace(/[^\d]/g, ''));
      if (Number.isInteger(y) && y >= 2000 && y <= CURRENT_YEAR + 1) row.joinedYear = y;
      else {
        // 写上兜底值而不是留空，这样预览里显示的年份就是真正会入库的年份
        row.joinedYear = CURRENT_YEAR;
        errors.push(`第 ${line} 行：加入年份「${yearRaw}」不合法，已按当前年份 ${CURRENT_YEAR} 处理`);
      }
    }

    // 文件内部重复也要拦 —— 否则第二条会在写库时才失败，报错位置不直观
    if (seenIds.has(row.student_id)) {
      errors.push(`第 ${line} 行：学号 ${row.student_id} 在文件里重复，已跳过`);
      return;
    }
    if (seenEmails.has(row.email)) {
      errors.push(`第 ${line} 行：邮箱 ${row.email} 在文件里重复，已跳过`);
      return;
    }
    seenIds.add(row.student_id);
    seenEmails.add(row.email);
    rows.push(row);
  });

  return { rows, errors, recognized, ignored };
}

export interface ImportResult {
  added: number;
  /** 姓名 + 邮箱与库里已有成员一致、被覆盖更新的条数。 */
  updated: number;
  /** 逐条失败原因（多为学号/邮箱已存在且姓名对不上）。 */
  failures: string[];
}

/**
 * 逐行写入。
 *
 * 判重规则：**姓名 + 邮箱一致** → 覆盖更新该成员（重新导入同一批名单时，
 * 修正后的资料会顶掉旧记录，而不是被「学号已存在」挡住）；其余情况走新增，
 * 已存在的学号 / 邮箱会被 `addMember` 拒掉，原因逐条收集。
 */
export async function importMembers(rows: ParsedRow[]): Promise<ImportResult> {
  let added = 0;
  let updated = 0;
  const failures: string[] = [];
  const existing = await listMembers();
  for (const r of rows) {
    // 姓名 + 邮箱一致 → 覆盖更新
    const match = existing.find(
      m =>
        m.name.trim() === r.name.trim() &&
        m.email.toLowerCase() === r.email.toLowerCase()
    );
    if (match) {
      const { member, error } = await updateMember(match.id, {
        name: r.name,
        student_id: r.student_id,
        email: r.email,
        department: r.department,
        tags: r.tags,
        interests: r.interests,
        bio: r.bio,
        joinedYear: r.joinedYear,
      });
      if (member) updated += 1;
      else failures.push(`第 ${r.line} 行（${r.name} / ${r.student_id}）：${error ?? '覆盖失败'}`);
      continue;
    }
    const { member, error } = await addMember({
      name: r.name,
      student_id: r.student_id,
      email: r.email,
      department: r.department,
      tags: r.tags,
      interests: r.interests,
      bio: r.bio,
      joinedYear: r.joinedYear,
    });
    if (member) added += 1;
    else failures.push(`第 ${r.line} 行（${r.name} / ${r.student_id}）：${error ?? '写入失败'}`);
  }
  return { added, updated, failures };
}

/** 给管理员下载的模板，避免自己猜列名。 */
export function buildTemplateCsv(): string {
  const header = '姓名,学号,邮箱,部门,技术标签,兴趣方向,加入年份,简介';
  const sample = `张三,23451234,zhangsan@zju.edu.cn,技术部,"LLM、RAG",智慧交通,${CURRENT_YEAR},关注 Agent 与检索增强`;
  // 带 BOM，Excel 打开才不乱码
  return `﻿${header}\n${sample}\n`;
}
