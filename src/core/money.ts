// 金额一律用整数存：账户币种的最小单位（美元就是美分）。全程不用浮点数（需求说明书第 7 节、AC-I3）。

/** 把报表里的金额文本转成最小单位的整数。"-1.50" → -150，"1 234.56" → 123456，"" → 0。 */
export function parseMoney(text: string, decimals = 2): number {
  const s = text.replace(/[\s, ]/g, '');
  if (s === '' || s === '-') return 0;
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) throw new Error(`不是金额：${text}`);
  const [, sign, int = '', frac = ''] = m;
  if (frac.length > decimals) throw new Error(`小数位超过 ${decimals} 位：${text}`);
  const units = Number(int || '0') * 10 ** decimals + Number(frac.padEnd(decimals, '0') || '0');
  return sign === '-' ? -units : units;
}

/** 显示用：-15350 → "-$153.50"；signed 为 true 时正数带 "+"。 */
export function formatMoney(units: number, opts: { currency?: string; signed?: boolean; decimals?: number } = {}): string {
  const { currency = 'USD', signed = false, decimals = 2 } = opts;
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  const abs = Math.abs(units);
  const int = Math.floor(abs / 10 ** decimals);
  const frac = String(abs % 10 ** decimals).padStart(decimals, '0');
  const body = `${symbol}${int.toLocaleString('en-US')}${decimals ? `.${frac}` : ''}`;
  if (units < 0) return `-${body}`;
  return signed && units > 0 ? `+${body}` : body;
}

/** 百分比显示：0.011557 → "1.16%"（四舍五入到 digits 位）。 */
export function formatPct(ratio: number, digits = 2): string {
  return `${(Math.round(ratio * 100 * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;
}
