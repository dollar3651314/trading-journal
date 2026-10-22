// 原型专用：后台的模拟数据和操作（客户、活跃、订单、价格、设置）。操作只改这次打开的页面里的状态，刷新后恢复。
// 计算用 src/core/activity.ts 和 src/core/billing.ts 的真实口径；正式版换成 /api/admin/* 接口后删除这个文件。
import { useSyncExternalStore } from 'react';
import { addDays, type CustomerActivity } from '../../core/activity';
import { DEFAULT_PRICES, extendUntil, type OrderStatus, type Period } from '../../core/billing';
import { LOGIN_EMAIL, TODAY } from './data';

export const NOW = `${TODAY}T15:00:00Z`;
export const RECEIVE_DEMO = 'TPrototypeDemoAddressNotReaLPay111'; // 格式合法但不是真实地址；付费页另有"原型，请勿转账"提示

export interface Customer extends CustomerActivity {
  email: string;
  invite: string;
  sources: ('ea' | 'upload' | 'email')[];
  accounts: number;
  proUntil: string | null;
  proSource: 'trial' | 'order' | 'gift' | null;
  linkedAccount: string | null; // 原型里有交易数据的客户，对应 mock/data.ts 的账户
  trades: number;
}
export interface AdminOrder {
  id: string; code: string; customer: string; period: Period; amount: number;
  status: OrderStatus; createdAt: string; expiresAt: string; txHash: string | null; reason: string | null; confirmedAt: string | null;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

// 每个渠道的"质量"不同，方便在原型里看出差别：中文群留存高，Reddit 注册多但留不住
const CHANNELS: { channel: string; invite: string; n: number; activate: number; stay: number }[] = [
  { channel: 'cn-group', invite: 'CN-01', n: 8, activate: 0.9, stay: 0.75 },
  { channel: 'reddit', invite: 'RDT-01', n: 9, activate: 0.6, stay: 0.25 },
  { channel: 'calculator', invite: 'CALC-01', n: 7, activate: 0.7, stay: 0.5 },
  { channel: 'forexfactory', invite: 'FF-01', n: 4, activate: 0.5, stay: 0.4 },
];
const NAMES = ['kevin', 'lina', 'wei', 'marco', 'sara', 'jun', 'tom', 'ana', 'hao', 'nick', 'emma', 'li', 'omar', 'yuki', 'ben', 'zoe', 'raj', 'mei', 'dan', 'ivy', 'leo', 'fang', 'max', 'nora', 'sam', 'xin', 'paul', 'rui'];
const DOMAINS = ['gmail.com', 'outlook.com', 'qq.com', 'proton.me', '163.com'];

function makeCustomers(): Customer[] {
  const r = rng(20261019);
  const out: Customer[] = [];
  let i = 0;
  for (const ch of CHANNELS) {
    for (let k = 0; k < ch.n; k++, i++) {
      const registered = addDays(TODAY, -Math.floor(3 + r() * 45));
      const activated = r() < ch.activate ? addDays(registered, Math.floor(r() * 4)) : null;
      const activeDays: string[] = [];
      const dataDays: string[] = [];
      const ea = activated !== null && r() < 0.6;
      const keep = r() < ch.stay;
      for (let d = registered; d <= TODAY; d = addDays(d, 1)) {
        const age = Math.round((Date.parse(d) - Date.parse(registered)) / 86400000);
        const p = activated && d >= activated ? (keep ? 0.55 : Math.max(0, 0.5 - age * 0.06)) : age < 2 ? 0.6 : 0;
        if (r() < p) activeDays.push(d);
        if (activated && d >= activated && (ea ? keep || age < 10 : r() < 0.15)) dataDays.push(d);
      }
      const name = NAMES[i % NAMES.length]!;
      out.push({
        id: `c${String(i + 1).padStart(2, '0')}`, channel: ch.channel, invite: ch.invite, registered, activated, activeDays, dataDays, paid: [],
        email: `${name}${i > NAMES.length ? i : ''}@${DOMAINS[i % DOMAINS.length]}`,
        sources: activated ? (ea ? ['ea', ...(r() < 0.3 ? (['email'] as const) : [])] : [r() < 0.5 ? 'upload' : 'email']) : [],
        accounts: activated ? 1 + (r() < 0.3 ? 1 : 0) : 0,
        proUntil: addDays(registered, 14), proSource: 'trial', linkedAccount: null, trades: activated ? Math.floor(5 + r() * 120) : 0,
      });
    }
  }
  // 第 1 个客户就是原型里登录的那个人（trader@example.com），交易数据用考核账户；第 2 个用 MT4 账户
  Object.assign(out[0]!, { email: LOGIN_EMAIL, linkedAccount: 'ftmo-100k', sources: ['ea', 'email'], accounts: 2, trades: 75, activated: out[0]!.registered, proUntil: '2026-10-31', proSource: 'trial' });
  // 原型里登录的客户每天都在用：EA 每个交易日都有数据，近 3 周大多数天打开过
  const c1 = out[0]!;
  c1.dataDays = []; c1.activeDays = [];
  for (let d = c1.registered; d <= TODAY; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) c1.dataDays.push(d);
    if (r() < (d > addDays(TODAY, -21) ? 0.8 : 0.5)) c1.activeDays.push(d);
  }
  if (!c1.activeDays.includes(TODAY)) c1.activeDays.push(TODAY);
  Object.assign(out[9]!, { linkedAccount: 'mt4-personal', trades: 23 });
  // 两个已经付费的客户
  Object.assign(out[2]!, { proUntil: '2026-11-15', proSource: 'order', paid: [1500] });
  Object.assign(out[11]!, { proUntil: '2027-10-10', proSource: 'order', paid: [14400] });
  return out;
}

const hex = (seed: number) => { const r = rng(seed); return Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join(''); };
const ORDER = (id: string, code: string, customer: string, period: Period, status: OrderStatus, createdAt: string, extra: Partial<AdminOrder> = {}): AdminOrder => ({
  id, code, customer, period, amount: DEFAULT_PRICES[period], status, createdAt, expiresAt: new Date(Date.parse(createdAt) + 72 * 3600000).toISOString(), txHash: null, reason: null, confirmedAt: null, ...extra,
});

interface State {
  customers: Customer[];
  orders: AdminOrder[];
  requests: { customer: string; at: string; period: Period }[];
  prices: { period: Period; amount: number; at: string; by: string }[];
  settings: { address: string; network: 'TRC20'; trialDays: number; linkHours: number };
  views: { at: string; customer: string; by: string }[];
  log: { at: string; what: string }[];
}

function initial(): State {
  const customers = makeCustomers();
  const c = (n: number) => customers[n]!.id;
  return {
    customers,
    orders: [
      // 原型里登录的客户（c01）有 5 个状态各一笔订单，方便看付费页的每个状态
      ORDER('ORD-1006', 'PAYA7K2Q', c(0), 'month', 'pending', '2026-10-19T09:00:00Z'),
      ORDER('ORD-1005', 'PAYB4M8X', c(0), 'year', 'submitted', '2026-10-18T08:00:00Z', { amount: 13000, txHash: hex(5) }),
      ORDER('ORD-1004', 'PAYC9R3T', c(0), 'month', 'problem', '2026-10-18T12:00:00Z', { txHash: hex(4), reason: '链上金额是 14.00 USDT，比订单少 1.00 USDT' }),
      ORDER('ORD-1003', 'PAYD2W6N', c(0), 'month', 'expired', '2026-10-10T10:00:00Z'),
      ORDER('ORD-1002', 'PAYE5H1J', c(2), 'month', 'confirmed', '2026-10-16T03:00:00Z', { txHash: hex(2), confirmedAt: '2026-10-16T09:30:00Z' }),
      ORDER('ORD-1001', 'PAYF8L4P', c(11), 'year', 'confirmed', '2026-10-10T02:00:00Z', { txHash: hex(1), confirmedAt: '2026-10-10T07:12:00Z' }),
      ORDER('ORD-1007', 'PAYG3V7S', c(5), 'month', 'submitted', '2026-10-19T06:00:00Z', { txHash: hex(7) }),
    ],
    requests: [{ customer: c(7), at: '2026-10-19T11:20:00Z', period: 'month' }, { customer: c(14), at: '2026-10-18T22:05:00Z', period: 'year' }],
    prices: [
      { period: 'month', amount: 1500, at: '2026-10-15T08:00:00Z', by: 'admin' },
      { period: 'year', amount: 15000, at: '2026-10-15T08:00:00Z', by: 'admin' },
      { period: 'year', amount: 14400, at: '2026-10-17T10:00:00Z', by: 'admin' },
    ],
    settings: { address: RECEIVE_DEMO, network: 'TRC20', trialDays: 14, linkHours: 72 },
    views: [{ at: '2026-10-18T09:12:00Z', customer: c(2), by: 'admin' }],
    log: [],
  };
}

let state = initial();
const listeners = new Set<() => void>();
const set = (fn: (s: State) => State) => { state = fn(state); listeners.forEach((l) => l()); };
export const useAdmin = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => state);
export const currentPrice = (s: State, p: Period) => [...s.prices].filter((x) => x.period === p).sort((a, b) => a.at.localeCompare(b.at)).at(-1)!.amount;
export const customerById = (s: State, id: string) => s.customers.find((c) => c.id === id);
export const me = (s: State) => s.customers.find((c) => c.email === LOGIN_EMAIL)!;

let seq = 1008;
const code = () => `PAY${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
export const actions = {
  setPrice: (period: Period, amount: number) => set((s) => ({ ...s, prices: [...s.prices, { period, amount, at: new Date().toISOString(), by: 'admin' }] })),
  setSettings: (next: Partial<State['settings']>) => set((s) => ({ ...s, settings: { ...s.settings, ...next }, log: [...s.log, { at: new Date().toISOString(), what: `settings ${Object.keys(next).join(',')}` }] })),
  /** 生成收费链接（AC-P2）。金额按当前价格锁定，可以单独改。 */
  createOrder: (customer: string, period: Period, amount: number) => {
    const o = ORDER(`ORD-${seq++}`, code(), customer, period, 'pending', NOW, { amount });
    set((s) => ({ ...s, orders: [o, ...s.orders], requests: s.requests.filter((r) => r.customer !== customer) }));
    return o;
  },
  /** 确认到账（AC-P6、P7）：只有"客户已提交哈希"的订单能确认，确认后按第 7.7 节延长 Pro。 */
  confirm: (id: string) => set((s) => {
    const o = s.orders.find((x) => x.id === id);
    if (!o || o.status !== 'submitted') return s;
    return {
      ...s,
      orders: s.orders.map((x) => (x.id === id ? { ...x, status: 'confirmed', confirmedAt: NOW } : x)),
      customers: s.customers.map((c) => (c.id === o.customer ? { ...c, proUntil: extendUntil(c.proUntil, TODAY, o.period), proSource: 'order', paid: [...c.paid, o.amount] } : c)),
    };
  }),
  problem: (id: string, reason: string) => set((s) => ({ ...s, orders: s.orders.map((x) => (x.id === id && x.status === 'submitted' ? { ...x, status: 'problem', reason } : x)) })),
  cancel: (id: string) => set((s) => ({ ...s, orders: s.orders.map((x) => (x.id === id && (x.status === 'pending' || x.status === 'problem') ? { ...x, status: 'cancelled' } : x)) })),
  submitHash: (id: string, hash: string) => set((s) => ({ ...s, orders: s.orders.map((x) => (x.id === id ? { ...x, status: 'submitted', txHash: hash.trim(), reason: null } : x)) })),
  gift: (customer: string, days: number) => set((s) => ({ ...s, customers: s.customers.map((c) => (c.id === customer ? { ...c, proUntil: addDays(c.proUntil && c.proUntil >= TODAY ? c.proUntil : TODAY, days), proSource: 'gift' } : c)) })),
  request: (customer: string, period: Period) => set((s) => (s.requests.some((r) => r.customer === customer) ? s : { ...s, requests: [...s.requests, { customer, at: NOW, period }] })),
  /** 打开客户详情时留一条查看记录（AC-G9）。 */
  viewed: (customer: string) => set((s) => ({ ...s, views: [{ at: new Date().toISOString(), customer, by: 'admin' }, ...s.views] })),
};
