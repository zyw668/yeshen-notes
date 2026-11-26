/* ============================================================
 * note.js —— 笔记详情页逻辑
 * ------------------------------------------------------------
 * 职责：
 *   1. 从 URL 取 ?id=xxx，拉取对应笔记
 *   2. 把 Markdown 渲染成 HTML，对代码高亮
 *   3. 抽取标题生成右侧目录
 * ============================================================ */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await renderNavAuth(); // 先渲染导航，后面再往里追加"编辑"
  const id = getQuery('id');
  if (!id) { location.href = './index.html'; return; }

  const [note, categories] = await Promise.all([getNote(id), getCategories()]);
  if (!note) {
    document.getElementById('articleContent').innerHTML = '<p>笔记不存在或已删除。</p>';
    return;
  }

  // 标题 + 元信息
  document.title = note.title + ' - 夜神笔记';
  document.getElementById('articleTitle').textContent = note.title;
  const cat = categories.find((c) => c.id === note.categoryId);
  const catLabel = cat ? `${cat.icon} ${cat.name}` : '未分类';
  document.getElementById('articleMeta').textContent =
    `${catLabel} · 更新于 ${formatDate(note.updatedAt)}`;

  // 只有登录后才显示"编辑"入口（本地模式也显示），追加在左侧主链接末尾
  const user = await getCurrentUser();
  if (!isSupabaseConfigured() || user) {
    const navMain = document.getElementById('navMain');
    const a = document.createElement('a');
    a.href = `./editor.html?id=${note.id}`;
    a.textContent = '编辑';
    navMain.appendChild(a);
  }

  // 渲染 Markdown
  const contentEl = document.getElementById('articleContent');
  contentEl.innerHTML = renderMarkdown(note.content);
  highlightCodeIn(contentEl); // 代码高亮

  // 生成右侧目录
  renderToc(contentEl);
}

function renderToc(contentEl) {
  const toc = buildToc(contentEl);
  const tocEl = document.getElementById('toc');
  if (toc.length === 0) { tocEl.style.display = 'none'; return; }

  const html = `
    <div class="toc-title">目录</div>
    <ul>
      ${toc.map((t) => `
        <li class="${t.level}">
          <a href="#${t.id}" class="${t.level === 'h3' ? 'level-3' : ''}">${escapeHtml(t.text)}</a>
        </li>
      `).join('')}
    </ul>
  `;
  tocEl.innerHTML = html;
}
