// 原型专用：模拟登录。存在浏览器本地（键名带版本号 tj.session.v1，C55）；读写失败时当作没登录。
// 正式版改成服务器发的会话 Cookie（邮箱验证码登录，后台只认 ADMIN_EMAILS，架构方案 2.6），删掉这个文件。
import { useSyncExternalStore } from 'react';

export const ADMIN_EMAIL = 'admin@tradingjournal.example';
const KEY = 'tj.session.v1';
export interface Session { user: string | null; admin: string | null }

const listeners = new Set<() => void>();
let cache: Session | null = null;
function read(): Session {
  if (cache) return cache;
  try { cache = { user: null, admin: null, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { cache = { user: null, admin: null }; }
  return cache!;
}
function write(next: Session) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 隐私模式等：只在这次打开的页面里有效 */ }
  listeners.forEach((fn) => fn());
}

export const useSession = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, read);
export const loginUser = (email: string) => write({ ...read(), user: email });
export const logoutUser = () => write({ ...read(), user: null });
/** 后台只认管理员邮箱（AC-G6）；别的邮箱返回 false。 */
export function loginAdmin(email: string) {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return false;
  write({ ...read(), admin: ADMIN_EMAIL });
  return true;
}
export const logoutAdmin = () => write({ ...read(), admin: null });
