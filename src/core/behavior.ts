// 行为习惯规则（需求说明书 v1.2 第 7.3 节，AC-B1）。只描述发生了什么，不给建议（AC-B4）。
// 口径只写在这里一份：入账后计算、看板、交易列表、推送共用。
import { netPnl, type Trade } from './metrics';

export interface BehaviorParams {
  revenge: { enabled: boolean; windowMin: number; lotsRatio: number };
  overtrading: { enabled: boolean; lookbackDays: number; ratio: number; minTrades: number; minHistoryDays: number };
  holding: { enabled: boolean; lookbackDays: number; tradeRatio: number; summaryRatio: number; minSample: number };
}

export const DEFAULT_PARAMS: BehaviorParams = {
  revenge: { enabled: true, windowMin: 15, lotsRatio: 1.5 },
  overtrading: { enabled: true, lookbackDays: 20, ratio: 2, minTrades: 10, minHistoryDays: 5 },
  holding: { enabled: true, lookbackDays: 30, tradeRatio: 3, summaryRatio: 2, minSample: 5 },
};

export type Flag =
  | { rule: 'revenge'; ticket: string; prevTicket: string; minutes: number; lotsRatio: number }
  | { rule: 'overtrading'; day: string; count: number; average: number }
  | { rule: 'holding'; ticket: string; minutes: number; winAvgMinutes: number; ratio: number };

export interface HoldingSummary { lossAvgMinutes: number; winAvgMinutes: number; ratio: number; flagged: boolean }

const ms = (iso: string) => new Date(iso).getTime();
const minutes = (a: string, b: string) => (ms(b) - ms(a)) / 60000;
const DAY = 86400000;
const dayOf = (iso: string) => iso.slice(0, 10);
const isWeekday = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

/**
 * 报复性交易：一笔亏损单平仓后 windowMin 分钟内开了新仓，并且新仓手数 ≥ 上一笔的 lotsRatio 倍。
 * "上一笔"指新仓开仓之前最后平仓的那一笔。
 */
function revenge(trades: Trade[], p: BehaviorParams['revenge']): Flag[] {
  const byClose = [...trades].sort((a, b) => a.closeTime.localeCompare(b.closeTime));
  const out: Flag[] = [];
  for (const t of trades) {
    let prev: Trade | undefined;
    for (const c of byClose) {
      if (c.ticket === t.ticket) continue;
      if (c.closeTime <= t.openTime) prev = c; else break;
    }
    if (!prev || netPnl(prev) >= 0) continue;
    const gap = minutes(prev.closeTime, t.openTime);
    const ratio = t.lots / prev.lots;
    if (gap <= p.windowMin && ratio >= p.lotsRatio - 1e-9) {
      out.push({ rule: 'revenge', ticket: t.ticket, prevTicket: prev.ticket, minutes: Math.round(gap), lotsRatio: Math.round(ratio * 100) / 100 });
    }
  }
  return out;
}

/**
 * 过度交易：某个交易日的平仓笔数 ≥ 之前 lookbackDays 个交易日日均笔数的 ratio 倍，并且当天 ≥ minTrades 笔。
 * 交易日 = 周一到周五（UTC 日期），没有交易的交易日按 0 笔计入；从第一笔交易那天算起，历史不足 minHistoryDays 个交易日时不判断。
 */
function overtrading(trades: Trade[], p: BehaviorParams['overtrading']): Flag[] {
  if (trades.length === 0) return [];
  const counts = new Map<string, number>();
  for (const t of trades) counts.set(dayOf(t.closeTime), (counts.get(dayOf(t.closeTime)) ?? 0) + 1);
  const first = [...counts.keys()].sort()[0]!;
  const out: Flag[] = [];
  for (const [day, count] of counts) {
    if (count < p.minTrades) continue;
    const history: number[] = [];
    for (let d = new Date(ms(`${day}T00:00:00Z`) - DAY); d.toISOString().slice(0, 10) >= first && history.length < p.lookbackDays; d = new Date(d.getTime() - DAY)) {
      if (isWeekday(d)) history.push(counts.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    if (history.length < p.minHistoryDays) continue;
    const average = history.reduce((a, b) => a + b, 0) / history.length;
    if (count >= p.ratio * average) out.push({ rule: 'overtrading', day, count, average: Math.round(average * 10) / 10 });
  }
  return out.sort((a, b) => (a.rule === 'overtrading' && b.rule === 'overtrading' ? a.day.localeCompare(b.day) : 0));
}

/** 扛单（单笔）：亏损单的持仓时间 > 它平仓前 lookbackDays 天内盈利单平均持仓时间的 tradeRatio 倍；盈利单不足 minSample 笔时不判断。 */
function holding(trades: Trade[], p: BehaviorParams['holding']): Flag[] {
  const out: Flag[] = [];
  for (const t of trades) {
    if (netPnl(t) >= 0) continue;
    const from = ms(t.closeTime) - p.lookbackDays * DAY;
    const wins = trades.filter((w) => netPnl(w) > 0 && ms(w.closeTime) < ms(t.closeTime) && ms(w.closeTime) >= from);
    if (wins.length < p.minSample) continue;
    const winAvg = wins.reduce((a, w) => a + minutes(w.openTime, w.closeTime), 0) / wins.length;
    const held = minutes(t.openTime, t.closeTime);
    if (winAvg > 0 && held > p.tradeRatio * winAvg) {
      out.push({ rule: 'holding', ticket: t.ticket, minutes: Math.round(held), winAvgMinutes: Math.round(winAvg), ratio: Math.round((held / winAvg) * 10) / 10 });
    }
  }
  return out;
}

/** 扛单（汇总）：最近 lookbackDays 天亏损单平均持仓时间 ≥ 盈利单的 summaryRatio 倍（两类各至少 minSample 笔），否则返回 null。 */
export function holdingSummary(trades: Trade[], p: BehaviorParams['holding'] = DEFAULT_PARAMS.holding): HoldingSummary | null {
  if (trades.length === 0) return null;
  const last = Math.max(...trades.map((t) => ms(t.closeTime)));
  const recent = trades.filter((t) => ms(t.closeTime) > last - p.lookbackDays * DAY);
  const avg = (xs: Trade[]) => xs.reduce((a, t) => a + minutes(t.openTime, t.closeTime), 0) / xs.length;
  const wins = recent.filter((t) => netPnl(t) > 0);
  const losses = recent.filter((t) => netPnl(t) < 0);
  if (wins.length < p.minSample || losses.length < p.minSample) return null;
  const winAvg = avg(wins), lossAvg = avg(losses);
  const ratio = winAvg > 0 ? lossAvg / winAvg : 0;
  return { lossAvgMinutes: Math.round(lossAvg), winAvgMinutes: Math.round(winAvg), ratio: Math.round(ratio * 10) / 10, flagged: ratio >= p.summaryRatio };
}

export function detectBehavior(trades: Trade[], params: BehaviorParams = DEFAULT_PARAMS): Flag[] {
  return [
    ...(params.revenge.enabled ? revenge(trades, params.revenge) : []),
    ...(params.overtrading.enabled ? overtrading(trades, params.overtrading) : []),
    ...(params.holding.enabled ? holding(trades, params.holding) : []),
  ];
}

/** 看板汇总：每条规则的触发次数和对应交易的净盈亏合计（AC-B3）。过度交易按当天全部交易合计。 */
export function summarize(trades: Trade[], flags: Flag[]) {
  const byTicket = new Map(trades.map((t) => [t.ticket, t]));
  const sumTickets = (tickets: string[]) => tickets.reduce((a, k) => a + (byTicket.has(k) ? netPnl(byTicket.get(k)!) : 0), 0);
  const rev = flags.filter((f) => f.rule === 'revenge') as Extract<Flag, { rule: 'revenge' }>[];
  const over = flags.filter((f) => f.rule === 'overtrading') as Extract<Flag, { rule: 'overtrading' }>[];
  const hold = flags.filter((f) => f.rule === 'holding') as Extract<Flag, { rule: 'holding' }>[];
  const overDays = new Set(over.map((f) => f.day));
  return {
    revenge: { count: rev.length, net: sumTickets(rev.map((f) => f.ticket)) },
    overtrading: { count: over.length, net: trades.filter((t) => overDays.has(dayOf(t.closeTime))).reduce((a, t) => a + netPnl(t), 0) },
    holding: { count: hold.length, net: sumTickets(hold.map((f) => f.ticket)) },
  };
}
