// Shared chart pieces. Series colours were checked with the colour-vision validator
// (light: all pass; dark: protan WARN on slots 1–2, so every multi-series chart keeps a legend).
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { useSession } from '../data/store';
import { num } from '../lib/format';

const LIGHT = ['#1d6e42', '#bd8a1e', '#2b6fc2', '#c8643b'];
const DARK = ['#2a8752', '#b5892a', '#4f8fd8', '#d9694a'];

export function useChartTheme() {
  const dark = useSession((s) => s.dark);
  return {
    dark,
    series: dark ? DARK : LIGHT,
    grid: dark ? 'rgba(255,255,255,.06)' : '#ece3d0',
    axis: dark ? '#8f9a93' : '#8a8178',
    surface: dark ? '#101d16' : '#ffffff',
    muted: dark ? '#3a4a40' : '#d6cdb8',
  };
}

export function ChartTip({ active, payload, label, fmt = (v) => num(v), labelFmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-xs shadow-lift dark:border-white/10 dark:bg-navy-800">
      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{labelFmt ? labelFmt(label, payload) : label}</p>
      {payload.filter((p) => p.value != null).map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <b className="text-slate-900 dark:text-white">{fmt(p.value, p.dataKey)}</b>
        </p>
      ))}
    </div>
  );
}

const axisProps = (t) => ({ tick: { fill: t.axis, fontSize: 11 }, tickLine: false, axisLine: false });

/**
 * series: [{ key, name, dashed?, area? }]. Lines are 2px; a dashed line is used for targets/standards.
 */
export function TrendChart({ data, x = 'day', series, height = 260, fmt, yFmt = (v) => num(v), legend = series.length > 1, yDomain }) {
  const t = useChartTheme();
  const anyArea = series.some((s) => s.area);
  const C = anyArea ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <C data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || t.series[i]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color || t.series[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey={x} {...axisProps(t)} minTickGap={18} />
        <YAxis {...axisProps(t)} tickFormatter={yFmt} width={52} domain={yDomain} />
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ stroke: t.axis, strokeDasharray: '3 3' }} />
        {legend && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />}
        {series.map((s, i) => {
          const color = s.color || t.series[i];
          const common = { key: s.key, dataKey: s.key, name: s.name, stroke: color, strokeWidth: 2, dot: false, activeDot: { r: 5, stroke: t.surface, strokeWidth: 2 }, connectNulls: true, strokeDasharray: s.dashed ? '5 4' : undefined, isAnimationActive: false };
          return anyArea ? <Area type="monotone" fill={s.area ? `url(#g-${s.key})` : 'none'} {...common} /> : <Line type="monotone" {...common} />;
        })}
      </C>
    </ResponsiveContainer>
  );
}

/** Vertical bars. series stacked when `stack` is set; 2px surface gap between stacked fills. */
export function Bars({ data, x = 'day', series, height = 260, fmt, yFmt = (v) => num(v), stack, legend = series.length > 1, layout = 'horizontal' }) {
  const t = useChartTheme();
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: vertical ? 8 : 0, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={vertical} horizontal={!vertical} stroke={t.grid} />
        {/* Recharts only sees direct children, so no fragments around the axes. */}
        {vertical ? <XAxis type="number" {...axisProps(t)} tickFormatter={yFmt} /> : <XAxis dataKey={x} {...axisProps(t)} minTickGap={8} />}
        {vertical ? <YAxis type="category" dataKey={x} {...axisProps(t)} width={120} /> : <YAxis {...axisProps(t)} tickFormatter={yFmt} width={52} />}
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ fill: t.dark ? 'rgba(255,255,255,.04)' : 'rgba(31,61,43,.05)' }} />
        {legend && <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stack ? 'a' : undefined} fill={s.color || t.series[i]} stroke={t.surface} strokeWidth={stack ? 2 : 0} radius={stack ? (i === series.length - 1 ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Part-to-whole for a handful of slices, always with a legend list beside it. */
export function Donut({ data, height = 200, fmt = (v) => num(v), center }) {
  const t = useChartTheme();
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke={t.surface} strokeWidth={2} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.name} fill={d.color || t.series[i % t.series.length]} />)}
            </Pie>
            <Tooltip content={<ChartTip fmt={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color || t.series[i % t.series.length] }} />
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{d.name}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{fmt(d.value)}</span>
            <span className="w-10 text-right text-xs text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ data, k = 'v', height = 36, color }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp-${k}-${color || 'x'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color || t.series[0]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color || t.series[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={k} stroke={color || t.series[0]} strokeWidth={2} fill={`url(#sp-${k}-${color || 'x'})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
