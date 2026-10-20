import { describe, expect, it } from 'vitest';
import { formatMoney, formatPct, parseMoney } from '../src/core/money';
import { computeMetrics, netPnl, sessionOf, type Trade } from '../src/core/metrics';
import { computeRedLines, templateById } from '../src/core/rules';

const t = (p: Partial<Trade> & Pick<Trade, 'grossProfit'>): Trade => ({
  ticket: Math.random().toString(36).slice(2), symbol: 'XAUUSD', side: 'buy', lots: 0.1,
  openTime: '2026-10-19T10:00:00Z', closeTime: '2026-10-19T11:00:00Z', openPrice: '1', closePrice: '1',
  commission: 0, swap: 0, taxes: 0, ...p,
});

describe('金额', () => {
  it('报表文本转整数，不经过浮点数', () => {
    expect(parseMoney('-1.50')).toBe(-150);
    expect(parseMoney('1 234.56')).toBe(123456);
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('')).toBe(0);
    expect(() => parseMoney('1.234')).toThrow();
    expect(() => parseMoney('abc')).toThrow();
  });
  it('显示', () => {
    expect(formatMoney(-15350)).toBe('-$153.50');
    expect(formatMoney(123456, { signed: true })).toBe('+$1,234.56');
    expect(formatMoney(0, { signed: true })).toBe('$0.00');
    expect(formatPct(0.011557)).toBe('1.16%');
  });
});

describe('指标口径（需求说明书第 7 节）', () => {
  const trades = [
    t({ grossProfit: 10000, commission: -70, swap: -150, closeTime: '2026-10-19T16:30:00Z', openTime: '2026-10-19T14:00:00Z' }), // +97.80，美盘
    t({ grossProfit: -15000, commission: -350, closeTime: '2026-10-19T11:20:00Z', openTime: '2026-10-19T08:00:00Z', symbol: 'EURUSD.m' }), // -153.50，欧盘
    t({ grossProfit: 70, commission: -70, closeTime: '2026-10-18T09:00:00Z', openTime: '2026-10-18T02:00:00Z' }), // 持平，亚盘
  ];
  const m = computeMetrics(trades);
  it('净盈亏 = 毛利 + 佣金 + 隔夜利息 + 税', () => {
    expect(trades.map(netPnl)).toEqual([9780, -15350, 0]);
    expect(m.net).toBe(-5570);
  });
  it('胜率：持平计入分母', () => {
    expect(m.winRate).toBeCloseTo(1 / 3);
    expect(m.breakeven).toBe(1);
  });
  it('盈亏比和 Profit Factor', () => {
    expect(m.payoffRatio).toBeCloseTo(9780 / 15350);
    expect(m.profitFactor).toBeCloseTo(9780 / 15350);
    expect(computeMetrics([trades[0]!]).profitFactor).toBeNull();
    expect(computeMetrics([]).winRate).toBeNull();
  });
  it('最大回撤按平仓时间累计', () => {
    // 按平仓时间：0 → -153.50 → -55.70，峰值 0，最大回撤 -153.50
    expect(m.maxDrawdown).toBe(-15350);
  });
  it('成本占毛利：只算盈利单的毛利', () => {
    // 成本 = |(-70-350-70) + 0 + (-150)| = 640；盈利单毛利 = 10000
    expect(m.costRatio).toBeCloseTo(640 / 10000);
  });
  it('拆分合计等于总数；品种去掉后缀', () => {
    expect(m.bySymbol.reduce((a, g) => a + g.net, 0)).toBe(m.net);
    expect(m.bySession.reduce((a, g) => a + g.net, 0)).toBe(m.net);
    expect(m.bySymbol.map((g) => g.key).sort()).toEqual(['EURUSD', 'XAUUSD']);
  });
  it('时段按开仓时间的 UTC 小时', () => {
    expect(sessionOf('2026-10-19T06:59:00Z')).toBe('asia');
    expect(sessionOf('2026-10-19T07:00:00Z')).toBe('europe');
    expect(sessionOf('2026-10-19T13:00:00Z')).toBe('us');
    expect(sessionOf('2026-10-19T22:00:00Z')).toBe('asia');
  });
});

describe('考核红线（AC-R2，按 FTMO 官网原文手算）', () => {
  const two = templateById('ftmo-2step')!;
  const one = templateById('ftmo-1step')!;
  it('2-Step：日内线 = 当日 00:00 余额 − 5% 初始资金；总线 = 初始资金的 90%', () => {
    const r = computeRedLines(two, { initialCapital: 10_000_000, dayStartBalance: 9_850_000, equity: 9_710_000, balance: 9_850_000 });
    expect(r.dailyLine).toBe(9_350_000);
    expect(r.maxLine).toBe(9_000_000);
    expect(r.remaining).toBe(360_000); // 计算器效果图：还可亏 $3,600
    expect(r.breached).toBeNull();
  });
  it('2-Step：效果图的看板数字', () => {
    const r = computeRedLines(two, { initialCapital: 10_000_000, dayStartBalance: 10_129_026, equity: 10_013_456, balance: 10_123_456 });
    expect(r.dailyLine).toBe(9_629_026);
    expect(r.remaining).toBe(384_430);
    expect(r.dailyUsed).toBe(115_570);
    expect(r.maxUsed).toBe(0);
    expect(r.profitToTarget).toBe(876_544);
  });
  it('刚好触线算违规；低于两条线时还可亏为 0', () => {
    const r = computeRedLines(two, { initialCapital: 10_000_000, dayStartBalance: 10_000_000, equity: 9_500_000, balance: 9_500_000 });
    expect(r.breached).toBe('daily');
    expect(r.remaining).toBe(0);
  });
  it('总线比日内线更近时，以总线为准', () => {
    const r = computeRedLines(two, { initialCapital: 10_000_000, dayStartBalance: 9_200_000, equity: 9_100_000, balance: 9_100_000 });
    expect(r.dailyLine).toBe(8_700_000);
    expect(r.remaining).toBe(100_000);
  });
  it('1-Step：总线跟着历史最高的当日 00:00 余额上移，只升不降', () => {
    const r = computeRedLines(one, { initialCapital: 10_000_000, dayStartBalance: 10_300_000, equity: 10_250_000, balance: 10_250_000, highestDayStartBalance: 10_500_000 });
    expect(r.dailyLine).toBe(10_000_000); // 10,300,000 − 3% × 10,000,000
    expect(r.maxLine).toBe(9_500_000); // 10,500,000 − 10% × 10,000,000
    expect(r.remaining).toBe(250_000);
  });
});
