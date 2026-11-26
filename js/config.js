/* ============================================================
 * config.js —— 唯一的配置文件（请把你的 Supabase 信息填在这里）
 * ------------------------------------------------------------
 * 去哪里找这两个值：
 *   Supabase 项目 → 左侧 "Project Settings" → "API"
 *   - Project URL       → 填到下面 url
 *   - anon public key   → 填到下面 anonKey  （注意是 anon，不是 service_role！）
 *
 * 重要：anon key 本来就是设计为可以公开放在前端的，
 *      真正的安全靠数据库的 RLS 策略保证（见 sql/schema.sql）。
 *      千万别把 service_role key 放到这里，那等于把数据库钥匙公开。
 * ============================================================ */

window.SUPABASE_CONFIG = {
  url: 'https://xgtjhqibpmqqvhpqfrrg.supabase.co',      // 例如 https://xxxxxxxx.supabase.co
  anonKey: 'sb_publishable_z2E75oUg1Czl5Ro3sSeRzA_15p3YVEP'
};
