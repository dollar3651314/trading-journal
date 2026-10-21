// 行为习惯规则的用例（AC-B1：每条规则至少 6 组，包括刚好达到阈值、差一点没达到、历史不足不判断）。
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, detectBehavior, holdingSummary, summarize } from '../src/core/behavior';
import type { Trade } from '../src/core/metrics';

let n = 0;
const T = (open: string, close: string, gross: number, lots = 0.1): Trade => ({
  ticket: `t${++n}`, symbol: 'XAUUSD', side: 'buy', lots, openTime: `2026-10-${open}:00Z`, closeTime: `2026-10-${close}:00Z`,
  openPrice: '1', closePrice: '1', grossProfit: gross, commission: 0, swap: 0, taxes: 0,
});
const rules = (ts: Trade[], rule: string) => detectBehavior(ts).filter((f) => f.rule === rule);

describe('报复性交易（15 分钟内、手数 ≥ 1.5 倍）', () => {
  it('亏损平仓后 6 分钟、2 倍手数：标记', () => {
    const ts = [T('19T14:00', '19T14:05', -100, 0.1), T('19T14:11', '19T14:30', 50, 0.2)];
    expect(rules(ts, 'revenge')).toEqual([{ rule: 'revenge', ticket: ts[1]!.ticket, prevTicket: ts[0]!.ticket, minutes: 6, lotsRatio: 2 }]);
  });
  it('刚好 15 分钟、刚好 1.5 倍：标记', () => {
    const ts = [T('19T14:00', '19T14:05', -100, 0.2), T('19T14:20', '19T14:30', 50, 0.3)];
    expect(rules(ts, 'revenge')).toHaveLength(1);
  });
  it('16 分钟：不标记', () => {
    const ts = [T('19T14:00', '19T14:05', -100, 0.1), T('19T14:21', '19T14:30', 50, 0.2)];
    expect(rules(ts, 'revenge')).toHaveLength(0);
  });
  it('1.4 倍手数：不标记', () => {
    const ts = [T('19T14:00', '19T14:05', -100, 0.5), T('19T14:10', '19T14:30', 50, 0.7)];
    expect(rules(ts, 'revenge')).toHaveLength(0);
  });
  it('上一笔是盈利单：不标记', () => {
    const ts = [T('19T14:00', '19T14:05', 100, 0.1), T('19T14:06', '19T14:30', 50, 0.3)];
    expect(rules(ts, 'revenge')).toHaveLength(0);
  });
  it('"上一笔"是新仓开仓前最后平仓的那笔：中间隔了一笔盈利单就不算', () => {
    const ts = [T('19T13:00', '19T14:00', -100, 0.1), T('19T13:30', '19T14:03', 30, 0.1), T('19T14:05', '19T14:30', 50, 0.2)];
    expect(rules(ts, 'revenge')).toHaveLength(0);
  });
  it('关闭规则后不标记', () => {
    const ts = [T('19T14:00', '19T14:05', -100, 0.1), T('19T14:11', '19T14:30', 50, 0.2)];
    expect(detectBehavior(ts, { ...DEFAULT_PARAMS, revenge: { ...DEFAULT_PARAMS.revenge, enabled: false } })).toHaveLength(0);
  });
});

// 10-05（周一）到 10-16（周五）共 10 个交易日，每天 2 笔，日均 2；10-19（周一）当天 n 笔
const history = () => {
  const ts: Trade[] = [];
  for (const d of ['05', '06', '07', '08', '09', '12', '13', '14', '15', '16']) for (const h of ['09', '15']) ts.push(T(`${d}T${h}:00`, `${d}T${h}:30`, 10));
  return ts;
};
const dayWith = (count: number, day = '19') => Array.from({ length: count }, (_, i) => T(`${day}T${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, `${day}T${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '45' : '15'}`, 10));

describe('过度交易（≥ 20 日均值 × 2，且 ≥ 10 笔）', () => {
  it('日均 2 笔，当天 10 笔：标记', () => {
    const f = rules([...history(), ...dayWith(10)], 'overtrading');
    expect(f).toEqual([{ rule: 'overtrading', day: '2026-10-19', count: 10, average: 2 }]);
  });
  it('当天 9 笔（不到 10 笔）：不标记', () => {
    expect(rules([...history(), ...dayWith(9)], 'overtrading')).toHaveLength(0);
  });
  it('日均 6 笔，当天 11 笔（不到 2 倍）：不标记', () => {
    const busy = history().flatMap((t) => [t, { ...t, ticket: `${t.ticket}b` }, { ...t, ticket: `${t.ticket}c` }]);
    expect(rules([...busy, ...dayWith(11)], 'overtrading')).toHaveLength(0);
  });
  it('日均 6 笔，当天刚好 12 笔（刚好 2 倍）：标记', () => {
    const busy = history().flatMap((t) => [t, { ...t, ticket: `${t.ticket}b` }, { ...t, ticket: `${t.ticket}c` }]);
    expect(rules([...busy, ...dayWith(12)], 'overtrading')).toHaveLength(1);
  });
  it('历史只有 4 个交易日：不判断', () => {
    const ts = [...['13', '14', '15', '16'].map((d) => T(`${d}T09:00`, `${d}T09:30`, 10)), ...dayWith(12)];
    expect(rules(ts, 'overtrading')).toHaveLength(0);
  });
  it('没有交易的交易日按 0 笔计入均值', () => {
    // 10-12 到 10-16 只有 10-12 有 5 笔；之前 5 个交易日均值 = 1，当天 10 笔 → 标记
    const ts = [...dayWith(5, '12'), ...dayWith(10)];
    expect(rules(ts, 'overtrading')).toEqual([{ rule: 'overtrading', day: '2026-10-19', count: 10, average: 1 }]);
  });
});

// 5 笔盈利单，每笔持仓 20 分钟
const wins = () => ['13', '14', '15', '16', '17'].map((d) => T(`${d}T10:00`, `${d}T10:20`, 100));

describe('扛单（单笔 > 盈利单均值 × 3；汇总 ≥ 2 倍）', () => {
  it('亏损单持仓 61 分钟，盈利单均值 20 分钟：标记', () => {
    const loss = T('19T10:00', '19T11:01', -100);
    expect(rules([...wins(), loss], 'holding')).toEqual([{ rule: 'holding', ticket: loss.ticket, minutes: 61, winAvgMinutes: 20, ratio: 3.1 }]);
  });
  it('刚好 60 分钟（等于 3 倍）：不标记（要求大于）', () => {
    expect(rules([...wins(), T('19T10:00', '19T11:00', -100)], 'holding')).toHaveLength(0);
  });
  it('盈利单只有 4 笔：不判断', () => {
    expect(rules([...wins().slice(1), T('19T10:00', '19T15:00', -100)], 'holding')).toHaveLength(0);
  });
  it('盈利单不在 30 天内：不计入', () => {
    const old = ['01', '02', '03', '04', '05'].map((d) => ({ ...T(`${d}T10:00`, `${d}T10:20`, 100), openTime: `2026-09-${d}T10:00:00Z`, closeTime: `2026-09-${d}T10:20:00Z` }));
    expect(rules([...old, T('19T10:00', '19T15:00', -100)], 'holding')).toHaveLength(0);
  });
  it('盈利单不标记', () => {
    expect(rules([...wins(), T('19T10:00', '19T15:00', 100)], 'holding')).toHaveLength(0);
  });
  it('汇总：亏损单平均 45 分钟，盈利单平均 20 分钟 → 2.3 倍，标记', () => {
    const losses = ['13', '14', '15', '16', '17'].map((d) => T(`${d}T12:00`, `${d}T12:45`, -50));
    expect(holdingSummary([...wins(), ...losses])).toEqual({ lossAvgMinutes: 45, winAvgMinutes: 20, ratio: 2.3, flagged: true });
  });
  it('汇总：亏损单不足 5 笔时返回 null', () => {
    expect(holdingSummary([...wins(), T('19T12:00', '19T12:45', -50)])).toBeNull();
  });
});

describe('看板汇总（AC-B3）', () => {
  it('次数和对应交易的净盈亏合计', () => {
    const ts = [T('19T14:00', '19T14:05', -100, 0.1), T('19T14:11', '19T14:30', -250, 0.2)];
    const s = summarize(ts, detectBehavior(ts));
    expect(s.revenge).toEqual({ count: 1, net: -250 });
  });
});
