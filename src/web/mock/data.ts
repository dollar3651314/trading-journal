// 原型的模拟数据。交易是用固定种子生成的，看板上的所有数字都由 src/core 的同一套口径算出来，前后一定对得上（C43）。
// 账户里故意放了一个"空账户"，用来确认空状态的样子（C32）。
import type { Trade } from '../../core/metrics';

export interface Account {
  id: string;
  name: string;
  platform: 'MT4' | 'MT5';
  accountNo: string;
  currency: 'USD';
  serverTz: string;
  templateId: string | null;
  initialCapital: number;
  floating: number; // 最近一次报表的持仓浮动盈亏
  lastImport: string | null;
  trades: Trade[];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const SYMBOLS: [string, number, string][] = [
  ['XAUUSD', 0.42, '2650.00'], ['EURUSD', 0.2, '1.0850'], ['GBPJPY', 0.16, '194.200'], ['US30', 0.1, '42800'], ['USDJPY', 0.12, '151.20'],
];
const STRATEGY = ['breakout', 'pullback', 'ma', 'reversal'];
const EMOTION = ['calm', 'fomo', 'hesitant', 'revenge'];

function makeTrades(seed: number, n: number, endDay: string, suffix = ''): Trade[] {
  const r = rng(seed);
  const out: Trade[] = [];
  const end = new Date(`${endDay}T21:00:00Z`).getTime();
  let day = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0 && r() < 0.45) day += 1;
    let t = end - day * 86400000;
    let d = new Date(t);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) { day += 1; t = end - day * 86400000; d = new Date(t); }
    const hour = [2, 4, 8, 9, 10, 14, 15, 16, 19][Math.floor(r() * 9)] ?? 9;
    const open = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, Math.floor(r() * 60)));
    // 约四分之一的单子持仓过夜（1–3 晚），会产生隔夜利息
    const nights = r() < 0.25 ? 1 + Math.floor(r() * 3) : 0;
    const close = new Date(open.getTime() + (nights * 1440 + 20 + Math.floor(r() * 300)) * 60000);
    let acc = 0; const pick = r(); let sym = SYMBOLS[0]!;
    for (const s of SYMBOLS) { acc += s[1]; if (pick <= acc) { sym = s; break; } }
    // 设定成接近真实的样子：亚盘偏亏、欧盘最好；GBPJPY 整体偏亏
    const edge = (hour >= 7 && hour < 13 ? 0.58 : hour >= 13 ? 0.5 : 0.36) - (sym[0] === 'GBPJPY' ? 0.15 : 0);
    const win = r() < edge;
    const gross = Math.round((win ? 40 + r() * 240 : -(40 + r() * 230)) * 100);
    const lots = Math.round((0.05 + r() * 0.45) * 100) / 100;
    const tags: string[] = [];
    if (r() < 0.7) tags.push(STRATEGY[Math.floor(r() * 4)]!);
    if (r() < 0.6) tags.push(EMOTION[win ? Math.floor(r() * 2) : 1 + Math.floor(r() * 3)]!);
    out.push({
      ticket: String(84920000 + seed * 1000 + i),
      symbol: sym[0] + suffix,
      side: r() < 0.55 ? 'buy' : 'sell',
      lots,
      openTime: open.toISOString(),
      closeTime: close.toISOString(),
      openPrice: sym[2],
      closePrice: sym[2],
      grossProfit: gross,
      commission: -Math.round(lots * 700),
      swap: nights ? -Math.round(nights * lots * (300 + r() * 900)) : 0,
      taxes: 0,
      tags,
    });
  }
  return out;
}

export const TODAY = '2026-10-19';

export const ACCOUNTS: Account[] = [
  {
    id: 'ftmo-100k', name: 'FTMO 100K', platform: 'MT5', accountNo: '5100231', currency: 'USD', serverTz: 'GMT+2/+3',
    templateId: 'ftmo-2step', initialCapital: 10_000_000, floating: -110_000, lastImport: '2026-10-19T21:05:00Z',
    trades: makeTrades(7, 62, TODAY),
  },
  {
    id: 'mt4-personal', name: 'IC Live', platform: 'MT4', accountNo: '880112', currency: 'USD', serverTz: 'GMT+2/+3',
    templateId: null, initialCapital: 500_000, floating: 0, lastImport: '2026-10-18T22:40:00Z',
    trades: makeTrades(11, 23, '2026-10-17', '.m'),
  },
  {
    id: 'new-empty', name: 'New (empty)', platform: 'MT5', accountNo: '—', currency: 'USD', serverTz: 'GMT+2/+3',
    templateId: null, initialCapital: 0, floating: 0, lastImport: null, trades: [],
  },
];

export const STRATEGY_TAGS = STRATEGY;
export const EMOTION_TAGS = EMOTION;

export const IMPORTS = [
  { id: 1, file: '10-19 Statement.htm', source: 'upload', status: 'ok', added: 12, skipped: 3, at: '2026-10-19T21:05:00Z' },
  { id: 2, file: '10-19 Daily Confirmation', source: 'email', status: 'parsing', added: 0, skipped: 0, at: '2026-10-19T21:01:00Z' },
  { id: 3, file: '10-18 Statement.htm', source: 'upload', status: 'failed', reason: 'noTable', added: 0, skipped: 0, at: '2026-10-18T20:40:00Z' },
  { id: 4, file: 'Re: Promotion', source: 'email', status: 'notStatement', added: 0, skipped: 0, at: '2026-10-18T08:12:00Z' },
] as const;

export const APPLICATIONS = [
  { email: 'k***@gmail.com', channel: 'reddit', at: '2026-10-20' },
  { email: 'l***@outlook.com', channel: 'calculator', at: '2026-10-20' },
  { email: 'w***@qq.com', channel: 'cn-group', at: '2026-10-19' },
];

export const INVITES = [
  { code: 'RDT-01', channel: 'reddit', used: 12, limit: 20 },
  { code: 'CALC-01', channel: 'calculator', used: 10, limit: 20 },
  { code: 'CN-01', channel: 'cn-group', used: 8, limit: 20 },
];

export const CHANNEL_STATS = [
  { channel: 'reddit', visits: 420, applied: 30, registered: 12, activated: 8, weekly: 5 },
  { channel: 'calculator', visits: 1050, applied: 25, registered: 10, activated: 6, weekly: 4 },
  { channel: 'cn-group', visits: 160, applied: 14, registered: 8, activated: 6, weekly: 3 },
  { channel: 'forexfactory', visits: 240, applied: 9, registered: 5, activated: 3, weekly: 1 },
];

export const INBOUND_ADDRESS = 'in+7f3k9q2xpa@tradingjournal.example';
