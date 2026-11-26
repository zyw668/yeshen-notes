/* ============================================================
 * editor.js —— 笔记编辑器逻辑
 * ------------------------------------------------------------
 * 职责：
 *   1. URL 带 ?id=xxx 时加载已有笔记；否则是新建
 *   2. 左边输入，右边实时预览 Markdown
 *   3. 保存 → 写入 storage → 跳转到详情页
 *   4. 删除（仅对已存在笔记显示）
 * ============================================================ */

let currentNoteId = null; // 正在编辑的笔记 id，null 表示新建

document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderNavAuth();
  // 登录守卫：未配置 Supabase 时放行（本地模式），否则必须登录
  if (!(await requireAuth())) return;

  const categories = await getCategories();

  // 填充分类下拉框
  const sel = document.getElementById('categorySelect');
  sel.innerHTML = categories.length
    ? categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')
    : '<option value="">（分类加载失败：请检查数据库权限）</option>';

  // 如果 URL 有 id，加载已有笔记
  currentNoteId = getQuery('id');
  if (currentNoteId) {
    const note = await getNote(currentNoteId);
    if (note) {
      document.getElementById('titleInput').value = note.title;
      document.getElementById('categorySelect').value = note.categoryId;
      document.getElementById('contentInput').value = note.content;
      document.getElementById('deleteBtn').style.display = '';
    }
  }

  // 初始预览 + 输入时实时刷新预览
  updatePreview();
  const contentInput = document.getElementById('contentInput');
  contentInput.addEventListener('input', updatePreview);

  // 让 Tab 键插入两个空格而不是跳到下一个控件（写代码更顺手）
  contentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
      updatePreview();
    }
  });

  // 按钮事件
  document.getElementById('saveBtn').addEventListener('click', saveCurrentNote);
  document.getElementById('backBtn').addEventListener('click', () => history.back());
  document.getElementById('deleteBtn').addEventListener('click', deleteCurrent);
}

// 把左边的 Markdown 渲染到右边预览区
function updatePreview() {
  const md = document.getElementById('contentInput').value;
  const preview = document.getElementById('preview');
  preview.innerHTML = renderMarkdown(md);
  highlightCodeIn(preview);
}

// 保存笔记（函数名故意不叫 saveNote，避免和 storage.js 的全局 saveNote 冲突导致递归）
async function saveCurrentNote() {
  const title = document.getElementById('titleInput').value.trim();
  const content = document.getElementById('contentInput').value;
  const categoryId = document.getElementById('categorySelect').value;

  if (!title) { alert('请先填写标题'); return; }
  if (!content.trim()) { alert('内容不能为空'); return; }

  // 自动生成摘要：去掉 Markdown 符号，取前 100 字
  const excerpt = content
    .replace(/[#*>`\-\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 100);

  const note = {
    id: currentNoteId || undefined, // 新建时为 undefined，storage 会自动生成
    title,
    categoryId,
    content,
    excerpt,
    published: true,
  };

  const saved = await saveNote(note); // 调用 storage.js 暴露的全局接口
  if (!saved) {
    // 保存失败（常见原因：数据库权限/RLS 策略未配置），明确告知，避免静默失败
    alert('保存失败：数据库拒绝了写入。\n请按 F12 打开控制台查看详细错误，或检查 Supabase 的表权限（GRANT）与 RLS 策略。');
    return;
  }
  // 跳转到详情页查看效果
  location.href = `./note.html?id=${saved.id}`;
}

// 删除当前笔记
async function deleteCurrent() {
  if (!currentNoteId) return;
  if (!confirm('确定删除这篇笔记吗？此操作不可撤销。')) return;
  await window.deleteNote(currentNoteId);
  location.href = './index.html';
}
