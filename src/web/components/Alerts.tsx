// 推送内容的预览：5 种内容（需求说明书 v1.2 第 7.4 节）× Telegram / 邮件。正式版由 Worker 按同样的结构生成。
// 推送里不出现任何品种、方向的建议，也不出现指令性的话；末尾有免责声明（AC-R6、AC-B4）。邮件带退订链接（AC-N6）。
import type { ReactNode } from 'react';
import { computeMetrics, netPnl } from '../../core/metrics';
import { Link, useT } from '../lib';
import { TODAY, type Account } from '../mock/data';
import { recentBehavior } from './Behavior';
import { accountRuleState, money, pct } from './ui';

export type Kind = 'daily' | 'weekly' | 'redline' | 'behavior' | 'eaDown';
export const KINDS: Kind[] = ['daily', 'weekly', 'redline', 'behavior', 'eaDown'];
const hhmm = (iso: string) => iso.slice(11, 16);

/** 推送正文（不含按钮和退订）。Telegram 和邮件共用。 */
function Body({ kind, acc }: { kind: Kind; acc: Account }) {
  const t = useT();
  const s = accountRuleState(acc, TODAY);
  if (kind === 'daily') {
    const today = acc.trades.filter((x) => x.closeTime.slice(0, 10) === TODAY);
    if (today.length === 0) return <>{t('report.none')}</>;
    const m = computeMetrics(today);
    const b = recentBehavior(acc.trades, TODAY, 1).summary;
    const hits = (['revenge', 'overtrading', 'holding'] as const).filter((r) => b[r].count > 0).map((r) => t('alert.ruleCount', { rule: t(`behavior.${r}`), n: b[r].count }));
    return <>
      {t('report.net', { net: money(today.reduce((a, x) => a + netPnl(x), 0), true), n: m.count, w: m.wins, l: m.losses })}<br />
      {s && <>{t('report.remaining', { amount: money(s.result.remaining), pct: pct(s.result.dailyUsage, 0) })}<br />{t('report.max', { amount: money(Math.max(0, s.equity - s.result.maxLine)) })}<br /></>}
      {hits.length > 0 && <>{t('alert.behaviorToday', { list: hits.join(' · ') })}<br /></>}
    </>;
  }
  if (kind === 'weekly') {
    const week = acc.trades.filter((x) => x.closeTime >= '2026-10-12' && x.closeTime < '2026-10-19');
    if (week.length === 0) return <>{t('alert.weeklyNone')}</>;
    const m = computeMetrics(week);
    const b = recentBehavior(acc.trades, '2026-10-18', 7).summary; // 用全部历史判断（过度交易要看之前的交易日）
    return <>
      {t('alert.weeklyNet', { net: money(m.net, true), n: m.count, rate: pct(m.winRate, 0) })}<br />
      {t('alert.weeklyBehavior', { revenge: b.revenge.count, over: b.overtrading.count, holding: b.holding.count })}<br />
    </>;
  }
  if (kind === 'redline') {
    const usage = s ? Math.max(0.72, s.result.dailyUsage) : 0.72;
    return <>⚠️ {t('alert.redline', { pct: pct(usage, 0), limit: s ? pct(s.tpl.dailyLossPct, 0) : '5%', amount: s ? money(s.result.remaining) : '—' })}<br />
      {t('alert.redlineSource', { time: acc.ea.lastPush ? hhmm(acc.ea.lastPush) : '—' })}<br /></>;
  }
  if (kind === 'behavior') {
    const f = recentBehavior(acc.trades, TODAY, 1).flags.find((x) => x.rule === 'revenge');
    return <>{f && f.rule === 'revenge' ? t('alert.behavior', { minutes: f.minutes, ratio: f.lotsRatio }) : t('alert.behaviorSample')}<br />
      {t('alert.behaviorDedupe')}<br /></>;
  }
  return <>{t('alert.eaDown', { time: acc.ea.lastPush ? hhmm(acc.ea.lastPush) : '—' })}<br />{t('alert.eaDownOnce')}<br /></>;
}

// 没装 EA 的每日战报按对账单估算；其他推送用通用的结尾
const foot = (kind: Kind, acc: Account) => (kind === 'daily' && acc.ea.status !== 'connected' ? 'report.foot' : 'alert.foot');
const title = (t: ReturnType<typeof useT>, kind: Kind, acc: Account) => t('alert.title', { kind: t(`notify.kind.${kind}`), account: acc.name, date: TODAY });

export function TgPreview({ kind, acc }: { kind: Kind; acc: Account }) {
  const t = useT();
  return (
    <div className="tg">
      <b>{title(t, kind, acc)}</b><br />
      <Body kind={kind} acc={acc} />
      <span className="f">{t(foot(kind, acc))}</span><br />
      <span className="k">{t('report.open')}</span>{kind === 'daily' && <span className="k">{t('report.tag')}</span>}
    </div>
  );
}

export function MailPreview({ kind, acc, to }: { kind: Kind; acc: Account; to: string }) {
  const t = useT();
  const row = (k: string, v: ReactNode) => <div><span className="f">{k}</span> {v}</div>;
  return (
    <div className="tg mail">
      {row(t('alert.mailFrom'), 'Trading Journal <notify@tradingjournal.example>')}
      {row(t('alert.mailTo'), to)}
      {row(t('alert.mailSubject'), <b>[Trading Journal] {title(t, kind, acc)}</b>)}
      <hr />
      <Body kind={kind} acc={acc} />
      <span className="k">{t('report.open')}</span><br /><br />
      <span className="f">{t(foot(kind, acc))}</span><br />
      <span className="f">{t('alert.mailWhy', { kind: t(`notify.kind.${kind}`) })} <Link to={`/unsubscribe?kind=${kind}&account=${acc.id}`}>{t('alert.unsubscribe')}</Link> · <Link to="/app/settings">{t('alert.manage')}</Link></span>
    </div>
  );
}
