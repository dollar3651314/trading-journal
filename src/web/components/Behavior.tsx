// 行为标记的显示：看板卡片、交易列表的标记、详情里的事实。规则口径在 src/core/behavior.ts，这里只负责显示。
// 文案只描述发生了什么，不出现"应该、建议、停止"等指令性的话（AC-B4）。
import { detectBehavior, holdingSummary, summarize, type Flag } from '../../core/behavior';
import type { Trade } from '../../core/metrics';
import { Link, useT } from '../lib';
import { money, sign } from './ui';

export type Rule = Flag['rule'];
export const RULES: Rule[] = ['revenge', 'overtrading', 'holding'];
const DAY = 86400000;

/** 近 days 天（以 today 为准）平仓的交易和它们的行为标记。原型用默认参数；正式版从 behavior_flags 表读，改参数不影响已有标记（AC-B5）。 */
export function recentBehavior(trades: Trade[], today: string, days = 30) {
  const from = new Date(new Date(`${today}T23:59:59Z`).getTime() - days * DAY).toISOString();
  const flags = detectBehavior(trades).filter((f) => (f.rule === 'overtrading' ? `${f.day}T23:59:59Z` : trades.find((x) => x.ticket === f.ticket)!.closeTime) > from);
  const recent = trades.filter((x) => x.closeTime > from);
  return { flags, summary: summarize(recent, flags), holding: holdingSummary(trades) };
}

/** 每笔交易对应的标记：报复性交易、扛单标在交易上；过度交易标在那一天的全部交易上。 */
export function flagsByTicket(trades: Trade[], flags: Flag[]) {
  const map = new Map<string, Flag[]>();
  const add = (k: string, f: Flag) => map.set(k, [...(map.get(k) ?? []), f]);
  for (const f of flags) {
    if (f.rule === 'overtrading') trades.filter((x) => x.closeTime.slice(0, 10) === f.day).forEach((x) => add(x.ticket, f));
    else add(f.ticket, f);
  }
  return map;
}

export function FlagChip({ rule }: { rule: Rule }) {
  const t = useT();
  return <span className="tag flag" style={{ cursor: 'default' }}>{t(`behavior.chip.${rule}`)}</span>;
}

export function FlagFact({ flag }: { flag: Flag }) {
  const t = useT();
  const dur = useDuration();
  const text = flag.rule === 'revenge' ? t('behavior.fact.revenge', { minutes: flag.minutes, ratio: flag.lotsRatio, prev: flag.prevTicket })
    : flag.rule === 'overtrading' ? t('behavior.fact.overtrading', { day: flag.day, count: flag.count, average: flag.average })
    : t('behavior.fact.holding', { held: dur(flag.minutes), avg: dur(flag.winAvgMinutes), ratio: flag.ratio });
  return <div className="flagfact"><FlagChip rule={flag.rule} />{text}</div>;
}

/** 持仓时间：不到 1 小时写分钟，否则写小时和分钟 */
export function useDuration() {
  const t = useT();
  return (min: number) => (min < 60 ? t('time.min', { m: min }) : t('time.hm', { h: Math.floor(min / 60), m: min % 60 }));
}

/** 看板卡片：近 30 天每条规则的次数和对应交易的净盈亏合计，点开看对应交易（AC-B3）。wide：电脑上三条规则横排。 */
export function BehaviorCard({ trades, today, wide = false }: { trades: Trade[]; today: string; wide?: boolean }) {
  const t = useT();
  const dur = useDuration();
  const { summary, holding } = recentBehavior(trades, today);
  const value = (r: Rule) => (summary[r].count === 0 ? <span className="mut">{t('behavior.none')}</span> : <>{t('behavior.count', { n: summary[r].count })} · <b className={sign(summary[r].net)}>{money(summary[r].net, true)}</b></>);
  return (
    <div className="card">
      <div className="h">{t('behavior.title')}</div>
      {wide ? (
        <div className="rules3">{RULES.map((r) => (
          <Link key={r} to={`/app/trades?flag=${r}&days=30`}><div className="mut">{t(`behavior.${r}`)} ›</div><div style={{ fontSize: 18, marginTop: 4 }}>{value(r)}</div></Link>
        ))}</div>
      ) : RULES.map((r) => (
        <Link key={r} to={`/app/trades?flag=${r}&days=30`} className="row">
          <span style={{ color: 'var(--fg)', padding: '7px 0' }}>{t(`behavior.${r}`)}</span>
          <span style={{ color: 'var(--fg)' }}>{value(r)} <span className="mut">›</span></span>
        </Link>
      ))}
      {holding && <div className="note" style={{ marginTop: 10 }}>{t(holding.flagged ? 'behavior.holdingSummaryHit' : 'behavior.holdingSummary', { loss: dur(holding.lossAvgMinutes), win: dur(holding.winAvgMinutes), ratio: holding.ratio })}</div>}
      <div className="note" style={{ marginTop: 4 }}>{t('behavior.disclaimer')}</div>
    </div>
  );
}
