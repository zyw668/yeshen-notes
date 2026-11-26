/* ============================================================
 * storage.js —— 数据访问层
 * ------------------------------------------------------------
 * 两条路径：
 *   A. 已配置 Supabase（config.js 填了 URL/Key）→ 读写云端数据库
 *   B. 未配置 → 降级用浏览器 localStorage（阶段1逻辑）
 *
 * 页面代码（list.js / note.js / editor.js）只调用这里的函数，
 * 不关心数据到底在云端还是本地——这就是数据层的意义。
 *
 * 字段映射（学习点）：
 *   数据库用 snake_case（category_id / is_published），
 *   前端用 camelCase（categoryId / published），
 *   转换只发生在本文件内部，页面拿到的永远是 camelCase。
 * ============================================================ */

const STORAGE_KEY = 'yeshen_notes_v1';

/* ============== 字段映射工具 ============== */
// 数据库行 → 前端笔记对象
function rowToNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    content: row.content,
    excerpt: row.excerpt,
    published: row.is_published,
    updatedAt: row.updated_at ? row.updated_at.slice(0, 10) : '',
  };
}
// 前端笔记对象 → 数据库可写字段（id 单独处理）
function noteToRow(note) {
  return {
    title: note.title,
    category_id: note.categoryId,
    content: note.content,
    excerpt: note.excerpt,
    is_published: note.published !== false,
  };
}

/* ============== 路径 A：Supabase ============== */

async function sbGetCategories() {
  const sb = getSupabase();
  const { data, error } = await sb.from('categories').select('*').order('sort');
  if (error) { console.error(error); return []; }
  return data;
}

async function sbGetNotes(options = {}) {
  const sb = getSupabase();
  let q = sb.from('notes').select('*');
  // 已登录用户能看全部；访客只能看已发布（RLS 也会兜底，这里再过滤一层）
  if (options.publishedOnly) q = q.eq('is_published', true);
  q = q.order('updated_at', { ascending: false });
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return (data || []).map(rowToNote);
}

async function sbGetNote(id) {
  const sb = getSupabase();
  const { data, error } = await sb.from('notes').select('*').eq('id', id).maybeSingle();
  if (error) { console.error(error); return null; }
  return rowToNote(data);
}

async function sbSaveNote(note) {
  const sb = getSupabase();
  const row = noteToRow(note);
  if (note.id) {
    // 更新
    const { data, error } = await sb.from('notes')
      .update(row).eq('id', note.id).select().maybeSingle();
    if (error) { console.error(error); return null; }
    return rowToNote(data);
  } else {
    // 新建
    const { data, error } = await sb.from('notes')
      .insert(row).select().maybeSingle();
    if (error) { console.error(error); return null; }
    return rowToNote(data);
  }
}

async function sbDeleteNote(id) {
  const sb = getSupabase();
  const { error } = await sb.from('notes').delete().eq('id', id);
  if (error) console.error(error);
}

/* ---- 分类的云端增删改 ---- */

async function sbCreateCategory(cat) {
  const sb = getSupabase();
  const { data, error } = await sb.from('categories')
    .insert({ id: cat.id, name: cat.name, icon: cat.icon, sort: cat.sort })
    .select().maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

async function sbUpdateCategory(id, patch) {
  const sb = getSupabase();
  const { data, error } = await sb.from('categories')
    .update(patch).eq('id', id).select().maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

async function sbDeleteCategory(id) {
  const sb = getSupabase();
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}

/* ============== 路径 B：localStorage（降级） ============== */
// （保留阶段1的实现，未配置 Supabase 时使用）

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { console.error(e); return {}; }
}
function saveOverrides(o) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)); }
function genId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'note-' + Date.now();
}
function mergeNotes() {
  const ov = loadOverrides();
  const map = {};
  SEED_NOTES.forEach((n) => { map[n.id] = n; });
  Object.keys(ov).forEach((id) => { map[id] = ov[id]; });
  return Object.values(map);
}

/* 本地模式的分类存储：存"新增/修改/删除"的差异，null 表示已删除 */
const CAT_KEY = 'yeshen_categories_v1';
function loadCatOverrides() {
  try {
    return JSON.parse(localStorage.getItem(CAT_KEY) || '{}');
  } catch (e) { console.error(e); return {}; }
}
function saveCatOverrides(o) { localStorage.setItem(CAT_KEY, JSON.stringify(o)); }
function mergeCategories() {
  const ov = loadCatOverrides();
  const map = {};
  CATEGORIES.forEach((c) => { map[c.id] = c; });
  Object.keys(ov).forEach((id) => {
    if (ov[id] === null) delete map[id];
    else map[id] = ov[id];
  });
  return Object.values(map).sort((a, b) => a.sort - b.sort);
}

/* ============== 对外统一接口（自动选路径） ============== */

async function getCategories() {
  return isSupabaseConfigured() ? sbGetCategories() : mergeCategories();
}

async function getNotes(options = {}) {
  if (isSupabaseConfigured()) return sbGetNotes(options);
  // 降级
  let list = mergeNotes();
  if (options.publishedOnly) list = list.filter((n) => n.published);
  return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

async function getNote(id) {
  if (isSupabaseConfigured()) return sbGetNote(id);
  return mergeNotes().find((n) => n.id === id) || null;
}

async function saveNote(note) {
  if (isSupabaseConfigured()) return sbSaveNote(note);
  // 降级
  const ov = loadOverrides();
  if (!note.id) note.id = genId();
  note.updatedAt = new Date().toISOString().slice(0, 10);
  ov[note.id] = note;
  saveOverrides(ov);
  return note;
}

async function deleteNote(id) {
  if (isSupabaseConfigured()) return sbDeleteNote(id);
  const ov = loadOverrides();
  if (SEED_NOTES.some((n) => n.id === id)) {
    ov[id] = { ...(SEED_NOTES.find((n) => n.id === id)), id, published: false };
  } else {
    delete ov[id];
  }
  saveOverrides(ov);
}

/* ============== 分类：新增 / 修改 / 删除 ============== */

// 新建分类，成功返回分类对象，失败返回 null
async function createCategory(cat) {
  if (isSupabaseConfigured()) return sbCreateCategory(cat);
  const ov = loadCatOverrides();
  if (mergeCategories().some((c) => c.id === cat.id)) return null;
  ov[cat.id] = cat;
  saveCatOverrides(ov);
  return cat;
}

// 修改分类（只允许改 name / icon / sort；id 是主键，改了会断开笔记关联）
async function updateCategory(id, patch) {
  if (isSupabaseConfigured()) return sbUpdateCategory(id, patch);
  const ov = loadCatOverrides();
  const base = mergeCategories().find((c) => c.id === id);
  if (!base) return null;
  ov[id] = { ...base, ...patch };
  saveCatOverrides(ov);
  return ov[id];
}

// 删除分类（该分类下的笔记会变成"未分类"，由数据库外键 on delete set null 保证）
async function deleteCategory(id) {
  if (isSupabaseConfigured()) return sbDeleteCategory(id);
  const ov = loadCatOverrides();
  ov[id] = null;
  saveCatOverrides(ov);
  return true;
}
