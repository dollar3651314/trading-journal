// 运营后台（只给 Amos，AC-G6）：渠道质量、客户列表和详情、收费（申请、订单、价格和收款设置）、内测和邀请码。
// 需求说明书 v1.3 草稿 CH6、CH7。口径用 src/core/activity.ts、billing.ts；数据是模拟的（mock/admin.ts）。后台以电脑为主，手机上能用（单栏）。
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { channelQuality, cohorts, daysBetween, addDays, statusOf, type Rate, type Status } from '../../core/activity';
import { effectiveStatus, formatUsdt, parseUsdt, planOf, type OrderStatus, type Period } from '../../core/billing';
import { computeMetrics, netPnl } from '../../core/metrics';
import { Toast, money, pct, sign } from '../components/ui';
import { Banner, Prefs } from '../components/Shell';
import { Link, fmtDate, navigate, useApp, useIsMobile, useLocation, useT } from '../lib';
import { actions, currentPrice, customerById, NOW, useAdmin, type AdminOrder, type Customer } from '../mock/admin';
import { ACCOUNTS, APPLICATIONS, CHANNEL_STATS, INVITES, TODAY } from '../mock/data';
import { ADMIN_EMAIL, logoutAdmin } from '../mock/session';

const NAV = [['/admin', 'admin.nav.channels'], ['/admin/customers', 'admin.nav.customers'], ['/admin/billing', 'admin.nav.billing'], ['/admin/beta', 'admin.nav.beta']] as const;
const r = (x: Rate) => (x.base === 0 ? '—' : `${Math.round((x.hit / x.base) * 100)}%`);
const rFull = (x: Rate) => (x.base === 0 ? '—' : `${r(x)}（${x.hit}/${x.base}）`);
const tronscan = (h: string) => `https://tronscan.org/#/transaction/${h}`;
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
const PAGE = 20;

function AdminShell({ children }: { children: ReactNode }) {
  const t = useT();
  const mobile = useIsMobile();
  const path = useLocation().split('?')[0];
  const on = (to: string) => (to === '/admin' ? path === '/admin' : path?.startsWith(to));
  return (
    <div className={mobile ? 'm' : ''}>
      <Banner />
      <div className="page">
        <div className="top">
          <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <Link to="/admin" className="logo">{t('app.name')} · {t('admin.title')}</Link>
            <nav className="nav">{NAV.map(([to, k]) => <Link key={to} to={to} className={on(to) ? 'on' : ''}>{t(k)}</Link>)}</nav>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><Prefs />{!mobile && <span className="mut">{ADMIN_EMAIL}</span>}<button className="pill" onClick={() => { logoutAdmin(); navigate('/admin/login'); }}>{t('nav.logout')}</button></div>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusChip({ s }: { s: Status }) {
  const t = useT();
  const color = { new: 'var(--acc)', active: 'var(--up)', dormant: 'var(--warn)', churned: 'var(--mut)' }[s];
  return <span className="tag" style={{ cursor: 'default', borderColor: color, color }}>{t(`admin.status.${s}`)}</span>;
}
function OrderChip({ s }: { s: OrderStatus }) {
  const t = useT();
  const color = { pending: 'var(--acc)', submitted: 'var(--warn)', confirmed: 'var(--up)', problem: 'var(--dn)', expired: 'var(--mut)', cancelled: 'var(--mut)' }[s];
  return <span className="tag" style={{ cursor: 'default', borderColor: color, color }}>{t(`order.status.${s}`)}</span>;
}
function PlanText({ c }: { c: Customer }) {
  const t = useT();
  const plan = planOf(c.proUntil, TODAY);
  return <span>{plan === 'pro' ? <b>Pro</b> : 'Free'}{plan === 'pro' && <span className="mut"> · {t(`admin.source.${c.proSource}`)} · {t('admin.until', { date: c.proUntil! })}</span>}</span>;
}

/** 渠道质量（AC-G10）：每个渠道一行，加上按注册周分组的留存表。 */
function Channels() {
  const t = useT();
  const s = useAdmin();
  const q = useMemo(() => channelQuality(s.customers, TODAY), [s.customers]);
  const rows = useMemo(() => cohorts(s.customers, TODAY), [s.customers]);
  const total = (k: 'registered' | 'activated' | 'active7' | 'paidUsers' | 'paidAmount') => q.reduce((a, x) => a + x[k], 0);
  return (
    <AdminShell>
      <div className="grid adapt2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[['admin.kpi.registered', total('registered')], ['admin.kpi.activated', total('activated')], ['admin.kpi.active7', total('active7')], ['admin.kpi.paid', `${total('paidUsers')} · ${formatUsdt(total('paidAmount'))}`]].map(([k, v]) => (
          <div key={k} className="card"><div className="mut">{t(String(k))}</div><div className="big" style={{ fontSize: 26 }}>{v}</div></div>
        ))}
      </div>
      <div className="card scroll-x" style={{ marginBottom: 20 }}>
        <div className="row"><div className="h" style={{ margin: 0 }}>{t('admin.quality.title')}</div><span className="mut">{t('admin.sample')}</span></div>
        <table>
          <thead><tr><th>{t('admin.channel')}</th><th className="r">{t('admin.kpi.registered')}</th><th className="r">{t('admin.q.activation')}</th><th className="r">{t('admin.q.activationDays')}</th>
            <th className="r">{t('admin.q.w1')}</th><th className="r">{t('admin.q.w2')}</th><th className="r">{t('admin.q.w4')}</th><th className="r">{t('admin.kpi.active7')}</th><th className="r">{t('admin.q.daysPerWeek')}</th><th className="r">{t('admin.q.paid')}</th></tr></thead>
          <tbody>{q.map((x) => (
            <tr key={x.channel}>
              <td><Link to={`/admin/customers?channel=${x.channel}`}>{t(`channel.${x.channel}`)}</Link></td>
              <td className="r">{x.registered}</td>
              <td className="r">{rFull(x.activation)}</td>
              <td className="r">{x.activationDaysMedian ?? '—'}</td>
              {(['w1', 'w2', 'w4'] as const).map((w) => <td key={w} className="r"><b>{r(x.retention[w].active)}</b><div className="mut" style={{ fontSize: 11.5 }}>{t('admin.q.dataShort', { v: r(x.retention[w].data) })} · {x.retention[w].active.hit}/{x.retention[w].active.base}</div></td>)}
              <td className="r">{x.active7}</td>
              <td className="r">{x.activeDaysPerWeek ?? '—'}</td>
              <td className="r">{x.paidUsers} · {formatUsdt(x.paidAmount)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="note" style={{ marginTop: 10 }}>{t('admin.q.note')}</div>
      </div>
      <div className="grid adapt" style={{ gridTemplateColumns: '1.3fr 1fr', alignItems: 'start' }}>
        <div className="card scroll-x">
          <div className="h">{t('admin.cohort.title')}</div>
          <table>
            <thead><tr><th>{t('admin.cohort.week')}</th><th className="r">{t('admin.cohort.size')}</th>{[0, 1, 2, 3, 4].map((n) => <th key={n} className="r">{t('admin.cohort.wn', { n })}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.week}><td>{row.week}</td><td className="r">{row.size}</td>{row.weeks.map((x, n) => <td key={n} className="r" style={{ background: x.base ? `rgba(31,111,235,${(x.hit / x.base) * 0.35})` : undefined }}>{r(x)}</td>)}</tr>)}</tbody>
          </table>
          <div className="note" style={{ marginTop: 8 }}>{t('admin.cohort.note')}</div>
        </div>
        <div className="card scroll-x">
          <div className="h">{t('admin.funnel.title')}</div>
          <table>
            <thead><tr><th>{t('admin.channel')}</th><th className="r">{t('admin.visits')}</th><th className="r">{t('admin.applied')}</th></tr></thead>
            <tbody>{CHANNEL_STATS.map((c) => <tr key={c.channel}><td>{t(`channel.${c.channel}`)}</td><td className="r">{c.visits}</td><td className="r">{c.applied}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

/** 客户列表（AC-G7）：按渠道、状态、套餐筛选，每页 20 个，可以翻页看到全部。 */
function Customers() {
  const t = useT();
  const { lang } = useApp();
  const mobile = useIsMobile();
  const s = useAdmin();
  const q0 = new URLSearchParams(location.search);
  const [f, setF] = useState({ channel: q0.get('channel') ?? '', status: '', plan: '' });
  const [page, setPage] = useState(0);
  const rows = s.customers
    .map((c) => ({ c, st: statusOf(c, TODAY), plan: planOf(c.proUntil, TODAY), last: c.activeDays.at(-1) ?? null, a30: c.activeDays.filter((d) => d > addDays(TODAY, -30)).length, d30: c.dataDays.filter((d) => d > addDays(TODAY, -30)).length }))
    .filter((x) => (!f.channel || x.c.channel === f.channel) && (!f.status || x.st === f.status) && (!f.plan || x.plan === f.plan))
    .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const filters = (
    <div className="row wrap" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 14 }}>
      <select className="pill" value={f.channel} onChange={(e) => set('channel', e.target.value)} aria-label={t('admin.channel')}><option value="">{t('admin.f.channel')}</option>{[...new Set(s.customers.map((c) => c.channel))].map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}</select>
      <select className="pill" value={f.status} onChange={(e) => set('status', e.target.value)} aria-label={t('admin.col.status')}><option value="">{t('admin.f.status')}</option>{(['new', 'active', 'dormant', 'churned'] as const).map((x) => <option key={x} value={x}>{t(`admin.status.${x}`)}</option>)}</select>
      <select className="pill" value={f.plan} onChange={(e) => set('plan', e.target.value)} aria-label={t('admin.col.plan')}><option value="">{t('admin.f.plan')}</option><option value="pro">Pro</option><option value="free">Free</option></select>
      <span className="mut">{t('admin.f.count', { n: rows.length, total: s.customers.length })}</span>
    </div>
  );
  const pager = rows.length > PAGE && (
    <div className="row" style={{ marginTop: 12 }}>
      <span className="mut">{t('common.pageInfo', { from: page * PAGE + 1, to: Math.min(rows.length, page * PAGE + PAGE), total: rows.length })}</span>
      <span className="row" style={{ gap: 8 }}><button className="btn2" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('common.prev')}</button><button className="btn2" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>{t('common.next')}</button></span>
    </div>
  );
  const src = (c: Customer) => (c.sources.length ? c.sources.map((x) => t(`admin.src.${x}`)).join(' · ') : '—');
  return (
    <AdminShell>
      <div className="card">
        <div className="h">{t('admin.customers.title')}</div>
        {filters}
        {mobile ? (
          <div className="stack">{pageRows.map(({ c, st, last, a30, d30 }) => (
            <Link key={c.id} to={`/admin/customers/${c.id}`} className="listrow">
              <span style={{ color: 'var(--fg)' }}><b>{c.email}</b><div className="mut">{t(`channel.${c.channel}`)} · <PlanText c={c} /></div><div className="mut">{t('admin.col.last')} {last ?? '—'} · {t('admin.col.days30v', { a: a30, d: d30 })}</div></span>
              <StatusChip s={st} />
            </Link>
          ))}</div>
        ) : (
          <div className="scroll-x"><table>
            <thead><tr><th>{t('admin.email')}</th><th>{t('admin.channel')}</th><th>{t('admin.col.registered')}</th><th>{t('admin.col.plan')}</th><th>{t('admin.col.sources')}</th><th className="r">{t('admin.col.accounts')}</th><th>{t('admin.col.last')}</th><th className="r">{t('admin.col.days30')}</th><th>{t('admin.col.status')}</th></tr></thead>
            <tbody>{pageRows.map(({ c, st, last, a30, d30 }) => (
              <tr key={c.id} className="click" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                <td><Link to={`/admin/customers/${c.id}`}>{c.email}</Link></td><td>{t(`channel.${c.channel}`)} <span className="mut">{c.invite}</span></td><td>{c.registered}</td><td><PlanText c={c} /></td>
                <td>{src(c)}</td><td className="r">{c.accounts}</td><td>{last ? fmtDate(`${last}T12:00:00Z`, lang).slice(0, lang === 'zh' ? 5 : 6) : '—'}</td><td className="r">{a30} / {d30}</td><td><StatusChip s={st} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {pager}
        <div className="note" style={{ marginTop: 10 }}>{t('admin.customers.note')}</div>
      </div>
    </AdminShell>
  );
}

/** 生成收费链接（AC-P2）：选周期，金额默认当前价格、可以改；生成后显示链接，"系统已发邮件"（原型）。 */
function SendLink({ customer, onDone, period: p0 = 'month' }: { customer: string; onDone?: (o: AdminOrder) => void; period?: Period }) {
  const t = useT();
  const s = useAdmin();
  const [period, setPeriod] = useState<Period>(p0);
  const [amount, setAmount] = useState((currentPrice(s, p0) / 100).toFixed(2));
  const [made, setMade] = useState<AdminOrder | null>(null);
  const cents = parseUsdt(amount);
  const ok = cents !== null && cents > 0;
  if (made) {
    return (
      <div className="previewbox">
        <div><b>{t('admin.link.made', { id: made.id })}</b></div>
        <div className="field row" style={{ margin: '6px 0' }}><span style={{ wordBreak: 'break-all' }}>{`${location.origin}/pay/${made.code}`}</span><button className="btn2" onClick={() => navigator.clipboard?.writeText(`${location.origin}/pay/${made.code}`).catch(() => {})}>{t('common.copy')}</button></div>
        <div className="mut">{t('admin.link.sent')}</div>
      </div>
    );
  }
  return (
    <div className="row wrap" style={{ justifyContent: 'flex-start', gap: 8 }}>
      <select className="pill" value={period} onChange={(e) => { const p = e.target.value as Period; setPeriod(p); setAmount((currentPrice(s, p) / 100).toFixed(2)); }} aria-label={t('admin.link.period')}>
        <option value="month">{t('plan.month')}</option><option value="year">{t('plan.year')}</option>
      </select>
      <input className="field" style={{ width: 110, margin: 0 }} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={t('admin.link.amount')} inputMode="decimal" />
      <span className="mut">USDT</span>
      <button className="btn" disabled={!ok} onClick={() => { const o = actions.createOrder(customer, period, cents!); setMade(o); onDone?.(o); }}>{t('admin.link.create')}</button>
      {!ok && <span className="err" style={{ margin: 0 }}>{t('admin.price.invalid')}</span>}
      {ok && cents !== currentPrice(s, period) && <span className="mut">{t('admin.link.custom', { price: formatUsdt(currentPrice(s, period)) })}</span>}
    </div>
  );
}

/** 活跃日历：近 90 天，主动和数据各一行（AC-G8）。 */
function ActivityStrip({ c }: { c: Customer }) {
  const t = useT();
  // 从注册那天开始显示，最多 90 天
  const from = c.registered > addDays(TODAY, -89) ? c.registered : addDays(TODAY, -89);
  const days = Array.from({ length: daysBetween(from, TODAY) + 1 }, (_, i) => addDays(from, i));
  const row = (set: Set<string>, color: string, label: string) => (
    <div className="row" style={{ justifyContent: 'flex-start', gap: 10, margin: '6px 0' }}>
      <span className="mut" style={{ width: 64, flex: 'none' }}>{label}</span>
      <div className="strip">{days.map((d) => <i key={d} title={d} style={{ background: set.has(d) ? color : 'var(--bar)' }} />)}</div>
    </div>
  );
  return <>{row(new Set(c.activeDays), 'var(--up)', t('admin.act.active'))}{row(new Set(c.dataDays), 'var(--acc)', t('admin.act.data'))}<div className="note">{t('admin.act.note', { from: days[0]!, to: TODAY })}</div></>;
}

function CustomerDetail({ id }: { id: string }) {
  const t = useT();
  const { lang } = useApp();
  const s = useAdmin();
  const c = customerById(s, id);
  const [toast, setToast] = useState<string | null>(null);
  const [gift, setGift] = useState('14');
  useEffect(() => { if (c) actions.viewed(c.id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <AdminShell><div className="card state">{t('admin.notFound')}</div></AdminShell>;
  const acc = ACCOUNTS.find((a) => a.id === c.linkedAccount);
  const m = acc && acc.trades.length ? computeMetrics(acc.trades) : null;
  const orders = s.orders.filter((o) => o.customer === c.id);
  const views = s.views.filter((v) => v.customer === c.id);
  const st = statusOf(c, TODAY);
  return (
    <AdminShell>
      <div className="row wrap" style={{ marginBottom: 16, gap: 10 }}>
        <span><Link to="/admin/customers">‹ {t('admin.nav.customers')}</Link>　<b style={{ fontSize: 18 }}>{c.email}</b>　<StatusChip s={st} /></span>
        <span className="mut">{t(`channel.${c.channel}`)} · {c.invite} · {t('admin.col.registered')} {c.registered} · {t('admin.activatedOn', { d: c.activated ? `${c.activated}（${daysBetween(c.registered, c.activated)}d）` : '—' })}</span>
      </div>
      <div className="grid adapt" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <div className="h">{t('admin.plan.title')}</div>
            <div style={{ marginBottom: 10 }}><PlanText c={c} /></div>
            <label className="lbl">{t('admin.link.title')}</label>
            <SendLink customer={c.id} onDone={() => setToast(t('admin.link.sent'))} />
            <label className="lbl" style={{ marginTop: 14 }}>{t('admin.gift.title')}</label>
            <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <input className="field" style={{ width: 80, margin: 0 }} value={gift} onChange={(e) => setGift(e.target.value.replace(/\D/g, ''))} aria-label={t('admin.gift.days')} inputMode="numeric" />
              <span className="mut">{t('admin.gift.days')}</span>
              <button className="btn2" disabled={!Number(gift)} onClick={() => { actions.gift(c.id, Number(gift)); setToast(t('admin.gift.done')); }}>{t('admin.gift.button')}</button>
            </div>
          </div>
          <div className="card">
            <div className="h">{t('admin.act.title')}</div>
            <ActivityStrip c={c} />
          </div>
          <div className="card scroll-x">
            <div className="h">{t('admin.orders.title')}</div>
            {orders.length === 0 ? <div className="mut">{t('admin.orders.none')}</div> : <OrderTable orders={orders} showCustomer={false} />}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <div className="row"><div className="h" style={{ margin: 0 }}>{t('admin.data.title')}</div><span className="mut">{t('admin.col.sources')}：{c.sources.map((x) => t(`admin.src.${x}`)).join(' · ') || '—'} · {t('admin.col.accounts')} {c.accounts}</span></div>
            {m && acc ? <>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '12px 0' }}>
                <div><div className="mut">{t('kpi.net')}</div><b className={sign(m.net)}>{money(m.net, true)}</b></div>
                <div><div className="mut">{t('kpi.winRate')}</div><b>{pct(m.winRate)}</b></div>
                <div><div className="mut">{t('admin.data.trades')}</div><b>{m.count}</b></div>
              </div>
              <div className="mut" style={{ marginBottom: 6 }}>{acc.name} · {acc.platform} #{acc.accountNo} · EA {t(`admin.ea.${acc.ea.status}`)}</div>
              <div className="scroll-x"><table><thead><tr><th>{t('col.closeTime')}</th><th>{t('col.symbol')}</th><th className="r">{t('col.lots')}</th><th className="r">{t('col.net')}</th></tr></thead>
                <tbody>{[...acc.trades].sort((a, b) => b.closeTime.localeCompare(a.closeTime)).slice(0, 8).map((x) => <tr key={x.ticket}><td>{fmtDate(x.closeTime, lang)}</td><td>{x.symbol}</td><td className="r">{x.lots.toFixed(2)}</td><td className={`r ${sign(netPnl(x))}`}>{money(netPnl(x), true)}</td></tr>)}</tbody></table></div>
              <div className="note" style={{ marginTop: 6 }}>{t('admin.data.same')}</div>
            </> : <div className="mut" style={{ marginTop: 10 }}>{t('admin.data.none')}</div>}
          </div>
          <div className="card">
            <div className="h">{t('admin.views.title')}</div>
            {views.slice(0, 5).map((v, i) => <div key={i} className="mut">{fmtDate(v.at, lang)} · {v.by}</div>)}
            <div className="note" style={{ marginTop: 6 }}>{t('admin.views.note')}</div>
          </div>
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </AdminShell>
  );
}

/** 订单表（AC-P6）：客户已提交哈希的订单可以确认到账或标记有问题（必须写原因）。 */
function OrderTable({ orders, showCustomer = true }: { orders: AdminOrder[]; showCustomer?: boolean }) {
  const t = useT();
  const { lang } = useApp();
  const s = useAdmin();
  const [problemFor, setProblemFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  return (
    <table>
      <thead><tr><th>{t('admin.o.id')}</th>{showCustomer && <th>{t('admin.email')}</th>}<th>{t('admin.o.plan')}</th><th className="r">{t('admin.o.amount')}</th><th>{t('admin.o.status')}</th><th>{t('admin.o.hash')}</th><th>{t('admin.o.created')}</th><th /></tr></thead>
      <tbody>{orders.map((o) => {
        const st = effectiveStatus(o, NOW);
        return (
          <tr key={o.id}>
            <td>{o.id}</td>
            {showCustomer && <td><Link to={`/admin/customers/${o.customer}`}>{customerById(s, o.customer)?.email}</Link></td>}
            <td>Pro · {t(`plan.${o.period}`)}</td>
            <td className="r">{formatUsdt(o.amount)}</td>
            <td><OrderChip s={st} />{o.reason && <div className="mut" style={{ fontSize: 11.5, maxWidth: 180 }}>{o.reason}</div>}</td>
            <td>{o.txHash ? <a href={tronscan(o.txHash)} target="_blank" rel="noreferrer" title={o.txHash}>{short(o.txHash)} ↗</a> : '—'}</td>
            <td>{fmtDate(o.createdAt, lang)}</td>
            <td className="r" style={{ whiteSpace: 'nowrap' }}>
              {st === 'submitted' && problemFor !== o.id && <><button className="btn" onClick={() => actions.confirm(o.id)}>{t('admin.o.confirm')}</button> <button className="btn2" onClick={() => { setProblemFor(o.id); setReason(''); }}>{t('admin.o.problem')}</button></>}
              {st === 'submitted' && problemFor === o.id && <span className="row" style={{ gap: 6 }}>
                <input className="field" style={{ margin: 0, width: 200 }} placeholder={t('admin.o.reason')} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t('admin.o.reason')} />
                <button className="btn2" disabled={!reason.trim()} onClick={() => { actions.problem(o.id, reason.trim()); setProblemFor(null); }}>{t('common.save')}</button>
              </span>}
              {(st === 'pending' || st === 'problem') && <button className="btn2" onClick={() => actions.cancel(o.id)}>{t('common.cancel')}</button>}
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

function Billing() {
  const t = useT();
  const { lang } = useApp();
  const s = useAdmin();
  const [toast, setToast] = useState<string | null>(null);
  const [fs, setFs] = useState<OrderStatus | ''>('');
  const [price, setPrice] = useState({ month: (currentPrice(s, 'month') / 100).toFixed(2), year: (currentPrice(s, 'year') / 100).toFixed(2) });
  const [cfg, setCfg] = useState({ address: s.settings.address, trialDays: String(s.settings.trialDays) });
  const [sendFor, setSendFor] = useState<string | null>(null);
  const orders = s.orders.filter((o) => !fs || effectiveStatus(o, NOW) === fs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const priceOk = (['month', 'year'] as const).every((p) => (parseUsdt(price[p]) ?? 0) > 0);
  const addrOk = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cfg.address.trim());
  const waiting = s.orders.filter((o) => effectiveStatus(o, NOW) === 'submitted').length;
  return (
    <AdminShell>
      <div className="grid adapt" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start', marginBottom: 20 }}>
        <div className="card">
          <div className="h">{t('admin.req.title')}</div>
          {s.requests.length === 0 && <div className="mut">{t('admin.req.none')}</div>}
          {s.requests.map((q) => {
            const c = customerById(s, q.customer)!;
            return (
              <div key={q.customer} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
                <div className="row"><span><Link to={`/admin/customers/${c.id}`}>{c.email}</Link> <span className="mut">· {t('admin.req.wants', { period: t(`plan.${q.period}`) })} · {fmtDate(q.at, lang)}</span></span>
                  {sendFor !== c.id && <button className="btn2" onClick={() => setSendFor(c.id)}>{t('admin.link.create')}</button>}</div>
                {sendFor === c.id && <div style={{ marginTop: 8 }}><SendLink customer={c.id} period={q.period} onDone={() => setToast(t('admin.link.sent'))} /></div>}
              </div>
            );
          })}
          <div className="note" style={{ marginTop: 8 }}>{t('admin.req.note')}</div>
        </div>
        <div className="card">
          <div className="h">{t('admin.price.title')}</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['month', 'year'] as const).map((p) => (
              <div key={p}><label className="lbl" htmlFor={`price-${p}`}>Pro · {t(`plan.${p}`)}（USDT）</label><input id={`price-${p}`} className="field" inputMode="decimal" value={price[p]} onChange={(e) => setPrice({ ...price, [p]: e.target.value })} /></div>
            ))}
          </div>
          {!priceOk && <div className="err">{t('admin.price.invalid')}</div>}
          <button className="btn" disabled={!priceOk} onClick={() => { (['month', 'year'] as const).forEach((p) => { const v = parseUsdt(price[p])!; if (v !== currentPrice(s, p)) actions.setPrice(p, v); }); setToast(t('admin.price.saved')); }}>{t('common.save')}</button>
          <div className="note" style={{ margin: '8px 0' }}>{t('admin.price.note')}</div>
          <div className="mut" style={{ marginTop: 8 }}>{t('admin.price.history')}</div>
          {[...s.prices].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((x, i) => <div key={i} className="mut" style={{ fontSize: 12.5 }}>{fmtDate(x.at, lang)} · {t(`plan.${x.period}`)} → {formatUsdt(x.amount)} · {x.by}</div>)}
        </div>
      </div>
      <div className="card scroll-x" style={{ marginBottom: 20 }}>
        <div className="row wrap"><div className="h" style={{ margin: 0 }}>{t('admin.orders.title')}{waiting > 0 && <span className="tag" style={{ cursor: 'default', marginLeft: 8, borderColor: 'var(--warn)', color: 'var(--warn)' }}>{t('admin.orders.waiting', { n: waiting })}</span>}</div>
          <select className="pill" value={fs} onChange={(e) => setFs(e.target.value as OrderStatus | '')} aria-label={t('admin.o.status')}><option value="">{t('admin.f.orderStatus')}</option>{(['pending', 'submitted', 'confirmed', 'problem', 'expired', 'cancelled'] as const).map((x) => <option key={x} value={x}>{t(`order.status.${x}`)}</option>)}</select></div>
        <div style={{ marginTop: 10 }}><OrderTable orders={orders} /></div>
        <div className="note" style={{ marginTop: 8 }}>{t('admin.orders.note')}</div>
      </div>
      <div className="card">
        <div className="h">{t('admin.cfg.title')}</div>
        <div className="grid adapt" style={{ gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div><label className="lbl" htmlFor="cfg-addr">{t('admin.cfg.address')}</label><input id="cfg-addr" className="field" value={cfg.address} onChange={(e) => setCfg({ ...cfg, address: e.target.value })} autoComplete="off" spellCheck={false} /></div>
          <div><label className="lbl">{t('admin.cfg.network')}</label><div className="field">USDT · TRC20</div></div>
          <div><label className="lbl" htmlFor="cfg-trial">{t('admin.cfg.trial')}</label><input id="cfg-trial" className="field" inputMode="numeric" value={cfg.trialDays} onChange={(e) => setCfg({ ...cfg, trialDays: e.target.value.replace(/\D/g, '') })} /></div>
        </div>
        {!addrOk && <div className="err">{t('admin.cfg.addrInvalid')}</div>}
        <div style={{ color: 'var(--warn)', fontSize: 12.5, marginBottom: 10 }}>⚠ {t('admin.cfg.noKey')}</div>
        <button className="btn" disabled={!addrOk} onClick={() => { actions.setSettings({ address: cfg.address.trim(), trialDays: Number(cfg.trialDays || 0) }); setToast(t('admin.cfg.saved')); }}>{t('common.save')}</button>
        <div className="note" style={{ marginTop: 8 }}>{t('admin.cfg.note')}</div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </AdminShell>
  );
}

/** 内测申请和邀请码（AC-G2、G3），v1.2 的内容不变。 */
function Beta() {
  const t = useT();
  const mobile = useIsMobile();
  return (
    <AdminShell>
      <div className="grid" style={{ gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', alignItems: 'start' }}>
        <div className="card scroll-x">
          <div className="h">{t('admin.applications')}</div>
          <table><thead><tr><th>{t('admin.email')}</th><th>{t('admin.channel')}</th><th>{t('admin.at')}</th><th /></tr></thead>
            <tbody>{APPLICATIONS.map((a) => <tr key={a.email}><td>{a.email}</td><td>{t(`channel.${a.channel}`)}</td><td>{a.at}</td><td className="r"><button className="btn2">{t('admin.send')}</button></td></tr>)}</tbody></table>
        </div>
        <div className="card scroll-x">
          <div className="row"><div className="h">{t('admin.invites')}</div><button className="btn2">{t('admin.newInvite')}</button></div>
          <table><thead><tr><th>{t('admin.code')}</th><th>{t('admin.channel')}</th><th className="r">{t('admin.used')}</th></tr></thead>
            <tbody>{INVITES.map((i) => <tr key={i.code}><td>{i.code}</td><td>{t(`channel.${i.channel}`)}</td><td className="r">{i.used} / {i.limit}</td></tr>)}</tbody></table>
        </div>
      </div>
    </AdminShell>
  );
}

export function Admin({ path }: { path: string }) {
  if (path === '/admin/customers') return <Customers />;
  if (path.startsWith('/admin/customers/')) return <CustomerDetail id={path.split('/')[3]!} />;
  if (path === '/admin/billing') return <Billing />;
  if (path === '/admin/beta') return <Beta />;
  return <Channels />;
}
