// 考核：今日红线（估算）、规则模板、Telegram 战报预览。战报里不出现任何品种和方向的建议（AC-R6）。
import { useState } from 'react';
import { computeMetrics, netPnl } from '../../core/metrics';
import { PENDING_TEMPLATES, TEMPLATES } from '../../core/rules';
import { LoadError, Loading, RedLineCard, accountRuleState, money, pct, useLoad } from '../components/ui';
import { Shell, useAccountId } from '../components/Shell';
import { useIsMobile, useT } from '../lib';
import { fetchAccount } from '../mock/api';
import { TODAY, type Account } from '../mock/data';

function Report({ acc }: { acc: Account }) {
  const t = useT();
  const today = acc.trades.filter((x) => x.closeTime.slice(0, 10) === TODAY);
  const m = computeMetrics(today);
  const s = accountRuleState(acc, TODAY);
  if (today.length === 0) return <div className="tg">{t('report.title', { date: TODAY, account: acc.name })}<br />{t('report.none')}</div>;
  return (
    <div className="tg">
      <b>{t('report.title', { date: TODAY, account: acc.name })}</b><br />
      {t('report.net', { net: money(today.reduce((a, x) => a + netPnl(x), 0), true), n: m.count, w: m.wins, l: m.losses })}<br />
      {s && <>{t('report.remaining', { amount: money(s.result.remaining), pct: pct(s.result.dailyUsage, 0) })}<br />{t('report.max', { amount: money(Math.max(0, s.equity - s.result.maxLine)) })}<br /></>}
      <span className="f">{t('report.foot')}</span><br />
      <span className="k">{t('report.open')}</span><span className="k">{t('report.tag')}</span>
    </div>
  );
}

export function Prop() {
  const t = useT();
  const mobile = useIsMobile();
  const { accountId } = useAccountId();
  const { data: acc, error, loading, retry } = useLoad(() => fetchAccount(accountId), [accountId]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [bound, setBound] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [time, setTime] = useState('08:00');

  if (loading) return <Shell><Loading /></Shell>;
  if (error || !acc) return <Shell><LoadError onRetry={retry} /></Shell>;
  const current = tplId ?? acc.templateId ?? 'ftmo-2step';
  const tpl = TEMPLATES.find((x) => x.id === current)!;
  const view = { ...acc, templateId: current, initialCapital: acc.initialCapital || 10_000_000 };

  const setup = (
    <div className="card">
      <div className="h">{t('prop.setup')}</div>
      <label className="lbl" htmlFor="tpl">{t('prop.template')}</label>
      <select id="tpl" className="field" value={current} onChange={(e) => setTplId(e.target.value)}>
        {TEMPLATES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        {PENDING_TEMPLATES.map((x) => <option key={x.id} disabled>{t('prop.pending', { name: x.name })}</option>)}
        <option disabled>{t('prop.custom')}</option>
      </select>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label className="lbl">{t('prop.capital')}</label><div className="field">{money(view.initialCapital)}</div></div>
        <div><label className="lbl">{t('prop.start')}</label><div className="field">2026-10-01</div></div>
      </div>
      <div className="note">{t(`prop.formula.${tpl.id}`)}</div>
      <div className="note" style={{ marginTop: 6 }}>{t('prop.source', { source: tpl.source, date: tpl.checkedOn })}</div>
    </div>
  );
  const tg = (
    <div className="card">
      <div className="h">{t('prop.tg')}</div>
      {bound ? (
        <div className="row" style={{ marginBottom: 10 }}>
          <span>{t('prop.tgBound')}</span>
          <select className="pill" value={time} onChange={(e) => setTime(e.target.value)} aria-label="push time">{['07:00', '08:00', '09:00', '21:00'].map((x) => <option key={x} value={x}>{t('prop.pushAt', { time: x })}</option>)}</select>
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div className="mut" style={{ marginBottom: 8 }}>{t('prop.tgUnbound')}</div>
          {code ? <div className="field">{t('prop.tgCode', { bot: '@TradingJournalBot', code })}</div> : <button className="btn" onClick={() => setCode('TJ-482913')}>{t('prop.tgBind')}</button>}
        </div>
      )}
      <div className="mut" style={{ marginBottom: 6 }}>{t('prop.preview')}</div>
      <Report acc={view} />
      <button className="btn2" style={{ marginTop: 10 }} onClick={() => { setBound(!bound); setCode(null); }}>{t('proto.toggleBind')}</button>
    </div>
  );
  return (
    <Shell>
      {mobile
        ? <div className="stack"><RedLineCard acc={view} today={TODAY} full />{tg}{setup}</div>
        : <div className="grid adapt" style={{ gridTemplateColumns: '1.1fr 1fr 1fr', alignItems: 'start' }}><RedLineCard acc={view} today={TODAY} full />{setup}{tg}</div>}
    </Shell>
  );
}
