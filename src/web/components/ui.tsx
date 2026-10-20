// 共用组件：只写一份，修一处全站生效（C46）。
import { useEffect, useState, type ReactNode } from 'react';
import { formatMoney, formatPct } from '../../core/money';
import type { Group } from '../../core/metrics';
import { computeRedLines, templateById } from '../../core/rules';
import type { Account } from '../mock/data';
import { useT, Link } from '../lib';

export const money = (u: number, signed = false) => formatMoney(u, { signed });
export const sign = (u: number) => (u > 0 ? 'up' : u < 0 ? 'dn' : '');
export const ratio = (x: number | null, digits = 2) => (x === null ? '—' : x.toFixed(digits));
export const pct = (x: number | null, digits = 1) => (x === null ? '—' : formatPct(x, digits));

export function Loading() {
  const t = useT();
  return <div className="card" aria-busy="true"><div className="mut">{t('common.loading')}</div><div className="skeleton" style={{ width: '60%' }} /><div className="skeleton" style={{ width: '80%' }} /><div className="skeleton" style={{ width: '40%' }} /></div>;
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return <div className="card state" role="alert"><div className="h">{t('common.loadError')}</div><button className="btn" onClick={onRetry}>{t('common.retry')}</button></div>;
}

export function Empty() {
  const t = useT();
  return (
    <div className="card state">
      <div style={{ fontSize: 40 }} aria-hidden>📄</div>
      <div className="h" style={{ marginTop: 8 }}>{t('empty.title')}</div>
      <div className="mut" style={{ marginBottom: 16 }}>{t('empty.body')}</div>
      <Link to="/app/import" className="btn">{t('empty.cta')}</Link>
      <div className="mut" style={{ marginTop: 12 }}><Link to="/app/import">{t('empty.howTo')}</Link></div>
    </div>
  );
}

/** 数据读取：加载中、出错、重试（C52）。 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    load().then((data) => alive && setState({ data, loading: false }), (error) => alive && setState({ error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, retry: () => setN((x) => x + 1) };
}

export function Kpi({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return <div className="card"><div className="mut">{label}</div><div className={`kv ${cls}`}>{value}</div></div>;
}

export function EquityCurve({ points, height }: { points: { equity: number }[]; height: number }) {
  const w = 1000;
  if (points.length === 0) return <div className="mut" style={{ height }}>—</div>;
  const ys = [0, ...points.map((p) => p.equity)];
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const pts = [{ equity: 0 }, ...points].map((p, i, a) => `${(i / (a.length - 1)) * w},${height - 6 - ((p.equity - min) / span) * (height - 14)}`).join(' ');
  const zero = height - 6 - ((0 - min) / span) * (height - 14);
  const color = (points[points.length - 1]?.equity ?? 0) >= 0 ? 'var(--up)' : 'var(--dn)';
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block', height }} role="img" aria-label="equity curve">
      <line x1="0" x2={w} y1={zero} y2={zero} stroke="var(--line)" strokeDasharray="4 4" />
      <polygon fill={color} opacity="0.12" points={`0,${height} ${pts} ${w},${height}`} />
      <polyline fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" points={pts} />
    </svg>
  );
}

export function Bars({ groups, label, height = 150 }: { groups: Group[]; label: (k: string) => string; height?: number }) {
  const t = useT();
  const mx = Math.max(1, ...groups.map((g) => Math.abs(g.net)));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: groups.length > 3 ? 6 : 12, height }}>
      {groups.map((g) => (
        <div key={g.key} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div className={`num ${sign(g.net)}`} style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{groups.length > 3 ? formatMoney(Math.round(g.net / 100), { signed: true, decimals: 0 }) : money(g.net, true)}</div>
          <div style={{ height: (Math.abs(g.net) / mx) * (height - 48), background: g.net >= 0 ? 'var(--up)' : 'var(--dn)', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
          <div className="mut" style={{ marginTop: 4 }}>{label(g.key)}</div>
          <div className="note">{t('kpi.trades', { n: g.count })}</div>
        </div>
      ))}
    </div>
  );
}

export function SymbolTable({ groups }: { groups: Group[] }) {
  const t = useT();
  return (
    <table>
      <thead><tr><th>{t('col.symbol')}</th><th className="r">{t('col.count')}</th><th className="r">{t('col.winRate')}</th><th className="r">{t('col.net')}</th></tr></thead>
      <tbody>{groups.map((g) => <tr key={g.key}><td>{g.key}</td><td className="r">{g.count}</td><td className="r">{pct(g.count ? g.wins / g.count : null, 0)}</td><td className={`r ${sign(g.net)}`}>{money(g.net, true)}</td></tr>)}</tbody>
    </table>
  );
}

/** 账户的考核状态：从平仓单推出当日 00:00 余额和当前余额，加上最近一次报表的持仓浮动。 */
export function accountRuleState(acc: Account, today: string) {
  const tpl = acc.templateId ? templateById(acc.templateId) : undefined;
  if (!tpl) return null;
  const net = (ts: typeof acc.trades) => ts.reduce((a, x) => a + x.grossProfit + x.commission + x.swap + x.taxes, 0);
  const before = acc.trades.filter((x) => x.closeTime.slice(0, 10) < today);
  const dayStartBalance = acc.initialCapital + net(before);
  const balance = acc.initialCapital + net(acc.trades);
  // 历史上每天 00:00 的余额，取最高（1-Step 用）
  const days = [...new Set(acc.trades.map((x) => x.closeTime.slice(0, 10)))].sort();
  const highest = Math.max(acc.initialCapital, ...days.map((d) => acc.initialCapital + net(acc.trades.filter((x) => x.closeTime.slice(0, 10) < d))));
  const equity = balance + acc.floating;
  return { tpl, balance, equity, dayStartBalance, result: computeRedLines(tpl, { initialCapital: acc.initialCapital, dayStartBalance, equity, balance, highestDayStartBalance: highest }) };
}

export function RedLineCard({ acc, today, full, footer }: { acc: Account; today: string; full: boolean; footer?: ReactNode }) {
  const t = useT();
  const s = accountRuleState(acc, today);
  if (!s) return <div className="card"><div className="h">{t('dash.noRule')}</div><Link to="/app/prop" className="btn2">{t('dash.setRule')}</Link></div>;
  const { tpl, result: r, equity } = s;
  const barCls = (u: number) => (u >= 1 ? 'over' : u >= 0.7 ? 'hot' : '');
  return (
    <div className="card">
      <div className="row"><div className="h" style={{ margin: 0 }}>{t('red.title')}</div><span className="mut">{tpl.name} · {money(acc.initialCapital).replace('.00', '')}</span></div>
      <div className={`big ${r.breached ? 'dn' : ''}`} style={{ margin: '6px 0 2px' }}>{money(r.remaining)}</div>
      <div className="mut">{t('red.dailyLine', { line: money(r.dailyLine), equity: money(equity) })}</div>
      {r.breached && <div className="dn" style={{ marginTop: 6 }}>{t(r.breached === 'daily' ? 'red.breachedDaily' : 'red.breachedMax')}</div>}
      <div className="row" style={{ marginTop: 14 }}><span>{t('red.daily', { used: pct(r.dailyUsedPct, 2), limit: pct(tpl.dailyLossPct, 0) })}</span><span className="mut">{t('red.usage', { pct: pct(r.dailyUsage, 0) })}</span></div>
      <div className="prog"><i className={barCls(r.dailyUsage)} style={{ width: `${r.dailyUsage * 100}%` }} /></div>
      <div className="row"><span>{t('red.max', { used: pct(r.maxUsedPct, 2), limit: pct(tpl.maxLossPct, 0) })}</span><span className="mut">{t('red.remainingShort', { amount: money(Math.max(0, equity - r.maxLine)) })}</span></div>
      <div className="prog"><i className={barCls(r.maxUsage)} style={{ width: `${r.maxUsage * 100}%` }} /></div>
      {full && r.profitPct !== null && tpl.profitTargetPct !== null && <>
        <div className="row"><span>{t('red.target', { pct: pct(r.profitPct, 2), limit: pct(tpl.profitTargetPct, 0) })}</span><span className="mut">{t('red.toTarget', { amount: money(r.profitToTarget ?? 0) })}</span></div>
        <div className="prog"><i className="acc" style={{ width: `${Math.min(1, Math.max(0, r.profitPct / tpl.profitTargetPct)) * 100}%` }} /></div>
      </>}
      <div className="note">{t('red.asOf', { date: today, floating: acc.floating ? t('red.withFloating') : t('common.noFloating') })}</div>
      {footer}
    </div>
  );
}

export function Toast({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => { if (!text) return; const id = setTimeout(onDone, 2500); return () => clearTimeout(id); }, [text, onDone]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}
