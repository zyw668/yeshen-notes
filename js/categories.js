/* ============================================================
 * categories.js —— 分类管理页逻辑（增 / 删 / 改 / 查）
 * ------------------------------------------------------------
 * 设计要点：
 *   1. 分类的 id 是主键，笔记通过 category_id 关联它。
 *      所以编辑时只允许改 名称 / 图标 / 排序，不允许改 id。
 *   2. 新建时自动生成一个不会重复的 id（英文名可直接当 id）。
 *   3. 删除分类不会删笔记，该分类下的笔记会变成"未分类"
 *      （数据库外键 on delete set null）。
 * ============================================================ */

let cats = [];          // 分类列表
let allNotes = [];      // 全部笔记（用于统计每个分类下的笔记数）
let editingId = null;   // 当前正在行内编辑的分类 id

document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderNavAuth();
  if (!(await requireAuth())) return; // 未登录跳登录页（本地模式放行）

  await load();
  document.getElementById('catForm').addEventListener('submit', onCreate);
}

// 拉取数据并渲染
async function load() {
  [cats, allNotes] = await Promise.all([getCategories(), getNotes()]);
  renderList();
}

// 渲染分类列表
function renderList() {
  const el = document.getElementById('catList');
  if (!cats.length) {
    el.innerHTML = '<div class="empty">还没有分类，先在上方添加一个</div>';
    return;
  }
  el.innerHTML = cats.map((c) => (c.id === editingId ? editRowHtml(c) : rowHtml(c))).join('');
  bindRowEvents();
}

// 普通展示行
function rowHtml(c) {
  const count = allNotes.filter((n) => n.categoryId === c.id).length;
  return `
    <div class="cat-row">
      <div class="cat-main">
        <span class="cat-icon">${escapeHtml(c.icon || '📁')}</span>
        <div>
          <div class="cat-name">${escapeHtml(c.name)}</div>
          <div class="cat-meta">id: ${escapeHtml(c.id)} · 排序 ${c.sort} · ${count} 篇笔记</div>
        </div>
      </div>
      <div class="cat-actions">
        <button class="btn" data-act="edit" data-id="${escapeHtml(c.id)}">编辑</button>
        <button class="btn btn-danger" data-act="del" data-id="${escapeHtml(c.id)}">删除</button>
      </div>
    </div>`;
}

// 行内编辑状态
function editRowHtml(c) {
  return `
    <div class="cat-row editing">
      <div class="cat-main">
        <input class="edit-icon" id="editIcon" type="text" maxlength="4" value="${escapeHtml(c.icon || '')}" placeholder="📁">
        <div class="edit-fields">
          <input id="editName" type="text" value="${escapeHtml(c.name)}" placeholder="分类名称">
          <input id="editSort" type="number" value="${c.sort}" placeholder="排序" class="sort-input">
          <div class="cat-meta">id: ${escapeHtml(c.id)}（不可修改）</div>
        </div>
      </div>
      <div class="cat-actions">
        <button class="btn btn-primary" data-act="save" data-id="${escapeHtml(c.id)}">保存</button>
        <button class="btn" data-act="cancel">取消</button>
      </div>
    </div>`;
}

// 绑定列表里所有按钮
function bindRowEvents() {
  document.querySelectorAll('#catList [data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (act === 'edit') { editingId = id; renderList(); }
      if (act === 'cancel') { editingId = null; renderList(); }
      if (act === 'save') onSave(id);
      if (act === 'del') onDelete(id);
    });
  });
}

// 新建分类
async function onCreate(e) {
  e.preventDefault();
  const name = document.getElementById('catName').value.trim();
  const icon = document.getElementById('catIcon').value.trim() || '📁';
  if (!name) return;

  // 生成唯一 id：英文/数字直接转小写当 id，中文则生成随机 id
  const base = /^[a-zA-Z0-9\-]+$/.test(name) ? name.toLowerCase() : 'cat-' + Date.now().toString(36);
  let id = base;
  while (cats.some((c) => c.id === id)) id = base + '-' + Math.random().toString(36).slice(2, 5);

  // 排序默认排在最后
  const maxSort = cats.reduce((m, c) => Math.max(m, Number(c.sort) || 0), 0);
  const sortInput = document.getElementById('catSort').value;
  const sort = sortInput ? Number(sortInput) : maxSort + 1;

  const created = await createCategory({ id, name, icon, sort });
  if (!created) {
    alert('添加失败：请查看控制台错误（可能是权限或 id 重复）');
    return;
  }
  document.getElementById('catForm').reset();
  await load();
}

// 保存行内编辑
async function onSave(id) {
  const name = document.getElementById('editName').value.trim();
  const icon = document.getElementById('editIcon').value.trim() || '📁';
  const sort = Number(document.getElementById('editSort').value) || 0;
  if (!name) { alert('名称不能为空'); return; }

  const updated = await updateCategory(id, { name, icon, sort });
  if (!updated) { alert('保存失败，请查看控制台错误'); return; }
  editingId = null;
  await load();
}

// 删除分类
async function onDelete(id) {
  const cat = cats.find((c) => c.id === id);
  const count = allNotes.filter((n) => n.categoryId === id).length;
  const tip = count > 0
    ? `确定删除分类「${cat.name}」吗？\n该分类下的 ${count} 篇笔记会变成「未分类」，笔记本身不会被删除。`
    : `确定删除分类「${cat.name}」吗？`;
  if (!confirm(tip)) return;

  const ok = await deleteCategory(id);
  if (!ok) { alert('删除失败，请查看控制台错误'); return; }
  await load();
}
