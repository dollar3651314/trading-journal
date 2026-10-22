// 登录后的页面框架：电脑是顶部导航，手机是底部标签栏（C64）。顶部始终显示原型标识。
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link, navigate, useApp, useIsMobile, useLocation, useT, type ThemePref } from '../lib';
import { accountList } from '../mock/api';
import { logoutUser, useSession } from '../mock/session';
import { me, NOW, useAdmin } from '../mock/admin';
import { effectiveStatus, formatUsdt } from '../../core/billing';

const TABS = [
  ['/app', 'nav.dashboard'], ['/app/trades', 'nav.trades'], ['/app/import', 'nav.import'], ['/app/prop', 'nav.prop'], ['/app/settings', 'nav.settings'],
] as const;

const AccountCtx = createContext<{ accountId: string; setAccountId: (id: string) => void }>({ accountId: 'ftmo-100k', setAccountId: () => {} });
export const useAccountId = () => useContext(AccountCtx);

export function Banner() {
  const t = useT();
  return <div className="banner">{t('proto.banner')}</div>;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const q = new URLSearchParams(location.search).get('account');
  const [accountId, setAccountId] = useState(accountList().some((a) => a.id === q) ? q! : 'ftmo-100k');
  return <AccountCtx.Provider value={{ accountId, setAccountId }}>{children}</AccountCtx.Provider>;
}

export function AccountPicker() {
  const { accountId, setAccountId } = useAccountId();
  return (
    <select className="pill" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="account">
      {accountList().map((a) => <option key={a.id} value={a.id}>{a.name} · {a.platform}</option>)}
    </select>
  );
}

/** 退出登录（F11）。电脑在顶部，手机在设置页底部。 */
export function LogoutButton({ block = false }: { block?: boolean }) {
  const t = useT();
  const { user } = useSession();
  return <button className={block ? 'btn2 block' : 'pill'} title={user ?? ''} onClick={() => { logoutUser(); navigate('/login'); }}>{t('nav.logout')}</button>;
}

/** 付费入口（P5）：客户有待付款或"有问题"的订单时，所有页面顶部都显示，点进去就是付费页。 */
function PayNotice() {
  const t = useT();
  const s = useAdmin();
  const path = useLocation();
  if (path.startsWith('/pay/')) return null; // 付费页自己就是入口
  const o = s.orders.find((x) => x.customer === me(s).id && ['pending', 'problem'].includes(effectiveStatus(x, NOW)));
  if (!o) return null;
  return <div className="paynotice"><span>{t(effectiveStatus(o, NOW) === 'problem' ? 'payNotice.problem' : 'payNotice.pending', { id: o.id, amount: formatUsdt(o.amount), network: o.network })}</span><Link to={`/pay/${o.code}`} className="btn">{t('plan.toPay')}</Link></div>;
}

export function Prefs() {
  const { lang, setLang, theme, setTheme } = useApp();
  const t = useT();
  const next: Record<ThemePref, ThemePref> = { system: 'dark', dark: 'light', light: 'system' };
  return <>
    <button className="pill" onClick={() => setTheme(next[theme])} aria-label={t('common.theme')}>{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'} {t(`common.theme.${theme}`)}</button>
    <button className="pill" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{t('common.lang')}</button>
  </>;
}

export function Shell({ children, wide = true }: { children: ReactNode; wide?: boolean }) {
  const t = useT();
  const path = useLocation().split('?')[0];
  const mobile = useIsMobile();
  const isOn = (to: string) => (to === '/app' ? path === '/app' || path === '/app/stats' : path?.startsWith(to));
  if (mobile) {
    return (
      <div className="m">
        <Banner />
        <div className="page">
          <div className="row" style={{ marginBottom: 14 }}><AccountPicker /><span className="row" style={{ gap: 6 }}><Prefs /></span></div>
          <PayNotice />
          {children}
        </div>
        <nav className="tabbar">{TABS.map(([to, k]) => <Link key={to} to={to} className={isOn(to) ? 'on' : ''}>{t(k)}</Link>)}</nav>
      </div>
    );
  }
  return (
    <div>
      <Banner />
      {/* 顶部导航始终是同一个宽度；wide=false 只收窄内容，左边和导航对齐，切换菜单时导航不跳动 */}
      <div className="page">
        <div className="top">
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <Link to="/app" className="logo">{t('app.name')}</Link>
            <nav className="nav">{TABS.map(([to, k]) => <Link key={to} to={to} className={isOn(to) ? 'on' : ''}>{t(k)}</Link>)}</nav>
          </div>
          <div className="row" style={{ gap: 8 }}><AccountPicker /><Prefs /><LogoutButton /></div>
        </div>
        <PayNotice />
        {wide ? children : <div style={{ maxWidth: 960 }}>{children}</div>}
        <div className="note" style={{ textAlign: 'center', marginTop: 20 }}>{t('common.disclaimer')}</div>
      </div>
    </div>
  );
}
