// 看板指标。口径只写在这里一份（需求说明书第 7 节），页面、接口、定时任务、计算器共用。

export interface Trade {
  ticket: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  openTime: string; // UTC，ISO 格式
  closeTime: string; // UTC，ISO 格式
  openPrice: string;
  closePrice: string;
  grossProfit: number; // 最小货币单位
  commission: number;
  swap: number;
  taxes: number;
  tags?: string[];
  note?: string;
}

export type Session = 'asia' | 'europe' | 'us';

/** 净盈亏 = 毛利 + 佣金 + 隔夜利息 + 税（按报表原值相加）。 */
export const netPnl = (t: Trade) => t.grossProfit + t.commission + t.swap + t.taxes;

/** 时段按开仓时间的 UTC 小时：亚盘 22:00–07:00、欧盘 07:00–13:00、美盘 13:00–22:00。 */
export function sessionOf(openTimeUtc: string): Session {
  const h = new Date(openTimeUtc).getUTCHours();
  if (h >= 7 && h < 13) return 'europe';
  if (h >= 13 && h < 22) return 'us';
  return 'asia';
}

/** 星期按开仓时间的 UTC 日期：0 = 周日 … 6 = 周六。 */
export const weekdayOf = (openTimeUtc: string) => new Date(openTimeUtc).getUTCDay();

export interface Group { key: string; count: number; wins: number; net: number }

export interface Metrics {
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  net: number;
  winRate: number | null; // 没有交易时为 null
  payoffRatio: number | null; // 盈亏比；没有盈利单或亏损单时为 null（显示"—"）
  profitFactor: number | null; // 没有亏损单时为 null（显示"—"）
  maxDrawdown: number; // 最小货币单位，≤ 0
  costRatio: number | null; // 成本占毛利；分母为 0 时为 null
  commission: number;
  swap: number;
  taxes: number;
  curve: { time: string; equity: number }[]; // 按平仓时间累计的净盈亏
  bySymbol: Group[];
  bySession: Group[];
  byWeekday: Group[];
}

const group = (trades: Trade[], keyOf: (t: Trade) => string): Group[] => {
  const map = new Map<string, Group>();
  for (const t of trades) {
    const k = keyOf(t);
    const g = map.get(k) ?? { key: k, count: 0, wins: 0, net: 0 };
    g.count += 1;
    g.net += netPnl(t);
    if (netPnl(t) > 0) g.wins += 1;
    map.set(k, g);
  }
  return [...map.values()];
};

export function computeMetrics(input: Trade[]): Metrics {
  const trades = [...input].sort((a, b) => a.closeTime.localeCompare(b.closeTime));
  const nets = trades.map(netPnl);
  const winNets = nets.filter((n) => n > 0);
  const lossNets = nets.filter((n) => n < 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const grossWin = sum(winNets);
  const grossLoss = Math.abs(sum(lossNets));

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const curve = trades.map((t, i) => {
    equity += nets[i] ?? 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
    return { time: t.closeTime, equity };
  });

  const commission = sum(trades.map((t) => t.commission));
  const swap = sum(trades.map((t) => t.swap));
  const taxes = sum(trades.map((t) => t.taxes));
  const negativeSwap = sum(trades.map((t) => Math.min(0, t.swap)));
  const grossProfitOfWinners = sum(trades.filter((t) => netPnl(t) > 0).map((t) => t.grossProfit));

  const sessions: Session[] = ['asia', 'europe', 'us'];
  const bySession = sessions.map((s) => group(trades.filter((t) => sessionOf(t.openTime) === s), () => s)[0] ?? { key: s, count: 0, wins: 0, net: 0 });
  // 周一到周五总是显示；周末有交易时才显示，保证各部分加起来等于总数（AC-D2）
  const days = [1, 2, 3, 4, 5, ...[6, 0].filter((d) => trades.some((t) => weekdayOf(t.openTime) === d))];
  const byWeekday = days.map((d) => group(trades.filter((t) => weekdayOf(t.openTime) === d), () => String(d))[0] ?? { key: String(d), count: 0, wins: 0, net: 0 });

  return {
    count: trades.length,
    wins: winNets.length,
    losses: lossNets.length,
    breakeven: nets.filter((n) => n === 0).length,
    net: sum(nets),
    winRate: trades.length ? winNets.length / trades.length : null,
    payoffRatio: winNets.length && lossNets.length ? grossWin / winNets.length / (grossLoss / lossNets.length) : null,
    profitFactor: lossNets.length ? grossWin / grossLoss : null,
    maxDrawdown,
    costRatio: grossProfitOfWinners ? Math.abs(commission + taxes + negativeSwap) / grossProfitOfWinners : null,
    commission,
    swap,
    taxes,
    curve,
    bySymbol: group(trades, (t) => t.symbol.replace(/[._-].*$/, '')).sort((a, b) => b.net - a.net),
    bySession,
    byWeekday,
  };
}
