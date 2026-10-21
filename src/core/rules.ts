// 考核规则模板（AC-R1、AC-R2）。每个模板写明官网出处和核对日期；规则改了就新增版本，不改旧版本。
// 只收录已经按官网原文核对过算法的模板。还没核对清楚的（FundedNext、The5ers）放在 PENDING_TEMPLATES，
// 页面上显示"核对中"，不参与计算，避免按猜测的算法给出错误的红线。

export interface RuleTemplate {
  id: string;
  version: number;
  name: string;
  source: string;
  checkedOn: string;
  resetTimezone: string;
  dailyLossPct: number; // 占初始资金的比例
  maxLossPct: number;
  profitTargetPct: number | null;
  /** fixed：总亏损线固定为初始资金 × (1 − maxLossPct)；trailing：取历史最高的当日 00:00 余额 − maxLossPct × 初始资金，只升不降 */
  maxLossMode: 'fixed' | 'trailing';
}

export const TEMPLATES: RuleTemplate[] = [
  {
    id: 'ftmo-2step', version: 1, name: 'FTMO 2-Step',
    source: 'https://ftmo.com/en/trading-objectives/', checkedOn: '2026-10-20', resetTimezone: 'CE(S)T',
    dailyLossPct: 0.05, maxLossPct: 0.1, profitTargetPct: 0.1, maxLossMode: 'fixed',
  },
  {
    id: 'ftmo-1step', version: 1, name: 'FTMO 1-Step',
    source: 'https://ftmo.com/en/trading-objectives/', checkedOn: '2026-10-20', resetTimezone: 'CE(S)T',
    dailyLossPct: 0.03, maxLossPct: 0.1, profitTargetPct: 0.1, maxLossMode: 'trailing',
  },
];

export const PENDING_TEMPLATES = [
  { id: 'fundednext-cfd', name: 'FundedNext（CFD）', source: 'https://help.fundednext.com/en/articles/8019811-how-can-i-calculate-the-daily-loss-limit' },
  { id: 'the5ers-2step', name: 'The5ers 2-Step', source: 'https://the5ers.com/faqs/2-step-plan-rules-specifications/' },
];

export interface RuleInput {
  initialCapital: number; // 最小货币单位
  dayStartBalance: number; // 当日重置时刻的余额
  equity: number; // 报表时刻的净值（含持仓浮动；不含时传余额）
  balance: number; // 报表时刻的余额
  highestDayStartBalance?: number; // trailing 模式需要：历史最高的当日 00:00 余额
}

export interface RuleResult {
  dailyLine: number; // 日内红线净值
  maxLine: number; // 总红线净值
  remaining: number; // 还可亏 = 净值 − 两条线里更高的那条（不小于 0）
  dailyUsed: number; // 今日已亏（≥ 0）
  dailyUsedPct: number; // 占初始资金
  dailyUsage: number; // 占日内限额的比例（进度条）
  maxUsed: number;
  maxUsedPct: number;
  maxUsage: number;
  profitPct: number | null; // 按余额计算的盈利比例
  profitToTarget: number | null; // 离盈利目标还差多少（≥ 0）
  breached: 'daily' | 'max' | null;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function computeRedLines(tpl: RuleTemplate, input: RuleInput): RuleResult {
  const { initialCapital: isc, dayStartBalance, equity, balance } = input;
  const dailyLimit = Math.round(tpl.dailyLossPct * isc);
  const maxLimit = Math.round(tpl.maxLossPct * isc);
  const dailyLine = dayStartBalance - dailyLimit;
  const maxBase = tpl.maxLossMode === 'trailing' ? Math.max(isc, input.highestDayStartBalance ?? isc, dayStartBalance) : isc;
  const maxLine = maxBase - maxLimit;
  const dailyUsed = Math.max(0, dayStartBalance - equity);
  const maxUsed = Math.max(0, maxBase - equity);
  const remaining = Math.max(0, equity - Math.max(dailyLine, maxLine));
  const target = tpl.profitTargetPct === null ? null : isc + Math.round(tpl.profitTargetPct * isc);
  return {
    dailyLine,
    maxLine,
    remaining,
    dailyUsed,
    dailyUsedPct: dailyUsed / isc,
    dailyUsage: clamp01(dailyUsed / dailyLimit),
    maxUsed,
    maxUsedPct: maxUsed / isc,
    maxUsage: clamp01(maxUsed / maxLimit),
    profitPct: tpl.profitTargetPct === null ? null : (balance - isc) / isc,
    profitToTarget: target === null ? null : Math.max(0, target - balance),
    breached: equity <= dailyLine ? 'daily' : equity <= maxLine ? 'max' : null,
  };
}

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
