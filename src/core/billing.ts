// 套餐、权限和订单的规则（需求说明书 v1.3 第 7.6、7.7 节，AC-P）。页面、推送、定时任务和后台共用这一份。
// 金额一律用整数：USDT 按 0.01 存（1500 = 15.00 USDT）。价格不写在这里，由后台设置（AC-P1）。
import { addDays } from './activity';

export type Plan = 'free' | 'pro';
export type Period = 'month' | 'year';
export const PERIOD_DAYS: Record<Period, number> = { month: 30, year: 365 };
export const DEFAULT_PRICES: Record<Period, number> = { month: 1500, year: 14400 };

/** 哪些功能属于 Pro（第 7.6 节）。数字是数量上限，true/false 是有没有。 */
export const FEATURES = {
  accounts: { free: 1, pro: 5 },
  import: { free: true, pro: true },
  dashboard: { free: true, pro: true },
  dailyReport: { free: true, pro: true },
  allTemplates: { free: false, pro: true },
  redlineAlert: { free: false, pro: true },
  behaviorAlert: { free: false, pro: true },
  eaDownAlert: { free: false, pro: true },
  weeklyReview: { free: false, pro: true },
} as const;
export type Feature = keyof typeof FEATURES;

/** 当前套餐：有没过期的 Pro（含试用、赠送）就是 Pro。到期日当天仍然有效。 */
export const planOf = (proUntil: string | null, today: string): Plan => (proUntil && proUntil >= today ? 'pro' : 'free');
export const can = (f: Feature, plan: Plan) => FEATURES[f][plan];

/** 确认到账后的新到期日：max(今天, 原到期日) + 30 或 365 天（第 7.7 节）。 */
export function extendUntil(proUntil: string | null, today: string, period: Period): string {
  const from = proUntil && proUntil >= today ? proUntil : today;
  return addDays(from, PERIOD_DAYS[period]);
}

/** 收款网络（Amos 2026-10-22：TRC20、ERC20、BNB 链三条都支持）。地址和交易哈希的格式按网络校验，区块浏览器用来给 Amos 核对。 */
export type Network = 'TRC20' | 'ERC20' | 'BEP20';
export const NETWORKS: Record<Network, { chain: string; address: RegExp; hash: RegExp; tx: (h: string) => string; addr: (a: string) => string }> = {
  TRC20: { chain: 'TRON', address: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, hash: /^[0-9a-fA-F]{64}$/, tx: (h) => `https://tronscan.org/#/transaction/${h}`, addr: (a) => `https://tronscan.org/#/address/${a}` },
  ERC20: { chain: 'Ethereum', address: /^0x[0-9a-fA-F]{40}$/, hash: /^0x[0-9a-fA-F]{64}$/, tx: (h) => `https://etherscan.io/tx/${h}`, addr: (a) => `https://etherscan.io/address/${a}` },
  BEP20: { chain: 'BNB Smart Chain', address: /^0x[0-9a-fA-F]{40}$/, hash: /^0x[0-9a-fA-F]{64}$/, tx: (h) => `https://bscscan.com/tx/${h}`, addr: (a) => `https://bscscan.com/address/${a}` },
};
export const NETWORK_LIST: Network[] = ['TRC20', 'ERC20', 'BEP20'];

/** 以太坊和 BNB 链的哈希、地址，钱包有时不带 0x：统一补上；TRON 的哈希不带 0x。 */
const norm = (n: Network, s: string) => { const v = s.trim(); return n !== 'TRC20' && /^[0-9a-fA-F]+$/.test(v) ? `0x${v}` : v; };
export const isTxHash = (n: Network, s: string) => NETWORKS[n].hash.test(norm(n, s));
export const isAddress = (n: Network, s: string) => NETWORKS[n].address.test(norm(n, s));
export const normalize = norm;

export type OrderStatus = 'pending' | 'submitted' | 'confirmed' | 'problem' | 'expired' | 'cancelled' | 'refunded';
export interface Order { id: string; status: OrderStatus; expiresAt: string; txHash: string | null; network: Network }

/** 页面上显示的状态：待付款或有问题的订单过了有效期就是已过期；客户已提交哈希的不会过期，等 Amos 处理。 */
export function effectiveStatus(o: Order, now: string): OrderStatus {
  if ((o.status === 'pending' || o.status === 'problem') && now > o.expiresAt) return 'expired';
  return o.status;
}

/** 客户点"我已付款"（AC-P5、P7）：要填付款地址和交易哈希，格式按订单的网络校验。usedHashes 是别的订单已经用过的哈希。 */
export function canSubmit(o: Order, payer: string, hash: string, now: string, usedHashes: string[]): 'ok' | 'payer' | 'format' | 'used' | 'closed' {
  const st = effectiveStatus(o, now);
  if (st !== 'pending' && st !== 'problem') return 'closed';
  if (!isAddress(o.network, payer)) return 'payer';
  if (!isTxHash(o.network, hash)) return 'format';
  const h = norm(o.network, hash).toLowerCase();
  if (usedHashes.some((x) => x.toLowerCase() === h)) return 'used';
  return 'ok';
}

/** 退款金额（P10，Amos 审批时填写）：大于 0，不超过订单金额。 */
export const validRefund = (amount: number | null, paid: number) => amount !== null && amount > 0 && amount <= paid;

/** 退款审批通过后立即取消 Pro：到期日改成昨天，今天起就是 Free（P10）。 */
export const revokedUntil = (today: string) => addDays(today, -1);

export const formatUsdt = (cents: number) => `${(cents / 100).toFixed(2)} USDT`;

/** 把输入的价格（"15"、"15.5"、"15.50"）转成整数；不合法返回 null。 */
export function parseUsdt(s: string): number | null {
  const m = /^\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
