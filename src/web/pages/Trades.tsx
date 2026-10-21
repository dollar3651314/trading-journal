// 交易列表和复盘：电脑是"列表 + 右侧详情"，手机是"列表 + 底部弹出的详情"（C64）。
// 筛选后显示"筛选后 X / 共 Y 笔"，超过 50 笔可以翻页看到全部（AC-D3、C49、C52）。被标记的交易显示规则名称，详情写明触发的事实，可以按行为标记筛选（AC-B2）。
import { useMemo, useState } from 'react';
import { netPnl, sessionOf, type Trade } from '../../core/metrics';
import { FlagChip, FlagFact, RULES, flagsByTicket, type Rule } from '../components/Behavior';
import { detectBehavior, type Flag } from '../../core/behavior';
import { Empty, LoadError, Loading, money, sign, useLoad } from '../components/ui';
import { Shell, useAccountId } from '../components/Shell';
import { fmtDate, useApp, useIsMobile, useT } from '../lib';
import { fetchAccount } from '../mock/api';
import { EMOTION_TAGS, STRATEGY_TAGS, TODAY } from '../mock/data';

const PAGE = 50;
const PAGE_MOBILE = 20;

function Detail({ trade, flags, tags, note, onTags, onNote, onSave, tz }: { trade: Trade; flags: Flag[]; tags: string[]; note: string; onTags: (t: string[]) => void; onNote: (n: string) => void; onSave: () => void; tz: string }) {
  const t = useT();
  const { lang } = useApp();
  const toggle = (x: string) => onTags(tags.includes(x) ? tags.filter((y) => y !== x) : [...tags, x]);
  const n = netPnl(trade);
  return (
    <div>
      <div className="row"><div className="h" style={{ margin: 0 }}>{trade.symbol} {t(`side.${trade.side}`)} {trade.lots.toFixed(2)}</div><b className={sign(n)}>{money(n, true)}</b></div>
      <div className="mut">#{trade.ticket} · {fmtDate(trade.openTime, lang)} → {fmtDate(trade.closeTime, lang)} UTC · {t('trades.serverTime', { tz })}</div>
      <div className="mut">{t('col.gross')} {money(trade.grossProfit, true)} · {t('col.commission')} {money(trade.commission)} · {t('col.swap')} {money(trade.swap)}</div>
      {flags.length > 0 && <div style={{ marginTop: 10 }}>{flags.map((x, i) => <FlagFact key={i} flag={x} />)}</div>}
      <label className="lbl" style={{ marginTop: 14 }}>{t('trades.strategy')}</label>
      <div>{STRATEGY_TAGS.map((x) => <button key={x} className={`tag ${tags.includes(x) ? 'on' : ''}`} aria-pressed={tags.includes(x)} onClick={() => toggle(x)}>{t(`tag.${x}`)}</button>)}<button className="tag">{t('trades.addTag')}</button></div>
      <label className="lbl" style={{ marginTop: 8 }}>{t('trades.emotion')}</label>
      <div>{EMOTION_TAGS.map((x) => <button key={x} className={`tag ${tags.includes(x) ? 'on' : ''}`} aria-pressed={tags.includes(x)} onClick={() => toggle(x)}>{t(`tag.${x}`)}</button>)}</div>
      <label className="lbl" style={{ marginTop: 8 }} htmlFor="note">{t('trades.note')}</label>
      <textarea id="note" className="field" rows={3} value={note} onChange={(e) => onNote(e.target.value)} />
      <button className="btn block" onClick={onSave}>{t('common.save')}</button>
    </div>
  );
}

export function Trades() {
  const t = useT();
  const { lang } = useApp();
  const mobile = useIsMobile();
  const { accountId } = useAccountId();
  const { data: acc, error, loading, retry } = useLoad(() => fetchAccount(accountId), [accountId]);
  const [f, setF] = useState({ symbol: '', side: '', tag: '', session: '', flag: new URLSearchParams(location.search).get('flag') ?? '', days: Number(new URLSearchParams(location.search).get('days')) || 0 });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { tags: string[]; note: string }>>({});
  const [saved, setSaved] = useState(false);

  const all = useMemo(() => [...(acc?.trades ?? [])].sort((a, b) => b.closeTime.localeCompare(a.closeTime)), [acc]);
  const tagsOf = (x: Trade) => edits[x.ticket]?.tags ?? x.tags ?? [];
  // 原型用默认参数在前端算；正式版从 behavior_flags 表读（架构方案 v1.1）
  const flagMap = useMemo(() => flagsByTicket(all, detectBehavior(all)), [all]);
  const flagsOf = (x: Trade) => flagMap.get(x.ticket) ?? [];
  const hasFlag = (x: Trade) => !f.flag || (f.flag === 'any' ? flagsOf(x).length > 0 : flagsOf(x).some((g) => g.rule === f.flag));
  const shown = all.filter((x) => (!f.symbol || x.symbol.startsWith(f.symbol)) && (!f.side || x.side === f.side) && (!f.tag || tagsOf(x).includes(f.tag)) && (!f.session || sessionOf(x.openTime) === f.session) && hasFlag(x) && (!f.days || x.closeTime > new Date(new Date(`${TODAY}T23:59:59Z`).getTime() - f.days * 86400000).toISOString()));
  const per = mobile ? PAGE_MOBILE : PAGE;
  const pageRows = shown.slice(page * per, page * per + per);
  const selected = all.find((x) => x.ticket === sel) ?? null;
  const symbols = [...new Set(all.map((x) => x.symbol.replace(/[._-].*$/, '')))];
  const set = (k: keyof typeof f, v: string | number) => { setF({ ...f, [k]: v }); setPage(0); };
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); if (mobile) setSel(null); };

  if (loading) return <Shell><Loading /></Shell>;
  if (error || !acc) return <Shell><LoadError onRetry={retry} /></Shell>;
  if (all.length === 0) return <Shell><Empty /></Shell>;

  const filters = (
    <div className="row wrap" style={{ justifyContent: 'flex-start', gap: 8 }}>
      <select className="pill" value={f.symbol} onChange={(e) => set('symbol', e.target.value)} aria-label={t('col.symbol')}><option value="">{t('trades.filterSymbol', { v: t('common.all') })}</option>{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <select className="pill" value={f.side} onChange={(e) => set('side', e.target.value)} aria-label={t('col.side')}><option value="">{t('trades.filterSide', { v: t('common.all') })}</option><option value="buy">{t('side.buy')}</option><option value="sell">{t('side.sell')}</option></select>
      <select className="pill" value={f.tag} onChange={(e) => set('tag', e.target.value)} aria-label={t('col.tags')}><option value="">{t('trades.filterTag', { v: t('common.all') })}</option>{[...STRATEGY_TAGS, ...EMOTION_TAGS].map((x) => <option key={x} value={x}>{t(`tag.${x}`)}</option>)}</select>
      <select className="pill" value={f.session} onChange={(e) => set('session', e.target.value)} aria-label="session"><option value="">{t('trades.filterSession', { v: t('common.all') })}</option>{['asia', 'europe', 'us'].map((x) => <option key={x} value={x}>{t(`session.${x}`)}</option>)}</select>
      <select className="pill" value={f.flag} onChange={(e) => set('flag', e.target.value)} aria-label={t('behavior.filter')}><option value="">{t('trades.filterFlag', { v: t('common.all') })}</option><option value="any">{t('trades.filterFlag', { v: t('behavior.any') })}</option>{RULES.map((r) => <option key={r} value={r}>{t('trades.filterFlag', { v: t(`behavior.${r}`) })}</option>)}</select>
      {f.days > 0 && <button className="tag on" onClick={() => set('days', 0)} aria-label={t('trades.clearDays')}>{t('trades.lastDays', { n: f.days })} ✕</button>}
    </div>
  );
  const chips = (x: Trade) => [...new Set(flagsOf(x).map((g) => g.rule))].map((r: Rule) => <FlagChip key={r} rule={r} />);
  const summary = <span className="mut">{t('trades.summary', { shown: shown.length, total: all.length, net: money(shown.reduce((a, x) => a + netPnl(x), 0), true) })}</span>;
  const pager = shown.length > per && (
    <div className="row" style={{ marginTop: 12 }}>
      <span className="mut">{t('common.pageInfo', { from: page * per + 1, to: Math.min(shown.length, page * per + per), total: shown.length })}</span>
      <span className="row" style={{ gap: 8 }}><button className="btn2" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('common.prev')}</button><button className="btn2" disabled={(page + 1) * per >= shown.length} onClick={() => setPage(page + 1)}>{t('common.next')}</button></span>
    </div>
  );
  const nothing = shown.length === 0 && <div className="card state mut">{t('empty.filtered', { total: all.length })}</div>;
  const detail = selected && <Detail trade={selected} flags={flagsOf(selected)} tz={acc.serverTz} tags={tagsOf(selected)} note={edits[selected.ticket]?.note ?? selected.note ?? ''}
    onTags={(tags) => setEdits({ ...edits, [selected.ticket]: { note: edits[selected.ticket]?.note ?? '', tags } })}
    onNote={(note) => setEdits({ ...edits, [selected.ticket]: { tags: tagsOf(selected), note } })} onSave={save} />;

  if (mobile) {
    return (
      <Shell>
        <div className="stack">
          {filters}
          {summary}
          {nothing}
          <div className="stack">{pageRows.map((x) => (
            <button key={x.ticket} className="card listrow" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSel(x.ticket)}>
              <span><b>{x.symbol}</b> <span className="mut">{t(`side.${x.side}`)} {x.lots.toFixed(2)}</span><div className="mut">{fmtDate(x.closeTime, lang)}</div>{chips(x)}</span>
              <b className={sign(netPnl(x))}>{money(netPnl(x), true)}</b>
            </button>
          ))}</div>
          {pager}
        </div>
        {selected && <><div className="sheet-bg" onClick={() => setSel(null)} /><div className="sheet" role="dialog" aria-modal="true"><div className="grab" />{detail}</div></>}
        {saved && <div className="toast" role="status">{t('common.saved')}</div>}
      </Shell>
    );
  }
  return (
    <Shell>
      <div className="card row wrap" style={{ padding: '12px 20px', marginBottom: 20 }}>{filters}{summary}</div>
      <div className="grid adapt" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'start' }}>
        <div className="card scroll-x">
          {nothing || <table>
            <thead><tr><th>{t('col.closeTime')}</th><th>{t('col.symbol')}</th><th>{t('col.side')}</th><th className="r">{t('col.lots')}</th><th className="r">{t('col.gross')}</th><th className="r">{t('col.commission')}</th><th className="r">{t('col.swap')}</th><th className="r">{t('col.net')}</th><th>{t('col.tags')}</th></tr></thead>
            <tbody>{pageRows.map((x) => (
              <tr key={x.ticket} className={`click ${sel === x.ticket ? 'sel' : ''}`} onClick={() => setSel(x.ticket)}>
                <td>{fmtDate(x.closeTime, lang)}</td><td>{x.symbol}</td><td>{t(`side.${x.side}`)}</td><td className="r">{x.lots.toFixed(2)}</td>
                <td className={`r ${sign(x.grossProfit)}`}>{money(x.grossProfit, true)}</td><td className="r">{money(x.commission)}</td><td className="r">{money(x.swap)}</td>
                <td className={`r ${sign(netPnl(x))}`}><b>{money(netPnl(x), true)}</b></td>
                <td>{chips(x)}{tagsOf(x).slice(0, 2).map((g) => <span key={g} className="tag" style={{ cursor: 'default' }}>{t(`tag.${g}`)}</span>)}</td>
              </tr>
            ))}</tbody>
          </table>}
          {pager}
        </div>
        <div className="card" style={{ position: 'sticky', top: 20 }}>{detail ?? <div className="mut">{t('trades.select')}</div>}</div>
      </div>
      {saved && <div className="toast" role="status">{t('common.saved')}</div>}
    </Shell>
  );
}
