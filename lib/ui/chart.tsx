/**
 * Responsive SVG line chart with counterfactual overlay (T6).
 * Scales with container width via viewBox + preserveAspectRatio.
 */

import { fmtKRWShort } from './format';

export type ChartPoint = {
  x: number;
  actual: number;
  counterfactual: number;
  claimed: boolean;
  expired?: boolean;
};

export type GrowthChartProps = {
  points: ChartPoint[];
  height?: number;
};

const VIEWBOX_W = 640;
const fmtKRW = fmtKRWShort;

export function GrowthChart({ points, height = 320 }: GrowthChartProps) {
  if (points.length === 0) {
    return (
      <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
        아직 기록이 없어요. 첫 청구 후 차트가 나타납니다.
      </div>
    );
  }

  if (points.length < 2) {
    const p = points[0]!;
    return (
      <div style={{ padding: 'var(--sp-5) var(--sp-3)', textAlign: 'center' }}>
        <div className="soft" style={{ marginBottom: 12 }}>
          {p.x}주차 데이터 1개. 다음 청구 후 곡선이 시작돼요.
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: 'var(--sp-4) var(--sp-5)',
            background: 'var(--experiment-bg)',
            border: '2px solid var(--experiment)',
            borderRadius: 'var(--r-md)',
            fontWeight: 700,
            fontSize: '1.5rem',
            color: 'var(--experiment-deep)',
          }}
        >
          {p.x}주차: {p.actual.toLocaleString('ko-KR')}원
        </div>
      </div>
    );
  }

  const margin = { top: 24, right: 20, bottom: 36, left: 56 };
  const innerW = VIEWBOX_W - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xMin = points[0]!.x;
  const xMax = points[points.length - 1]!.x;
  const xRange = Math.max(1, xMax - xMin);

  const allValues = points.flatMap((p) => [p.actual, p.counterfactual]);
  const yMax = Math.max(...allValues, 1);
  const yMin = 0;
  const yRange = Math.max(1, yMax - yMin);

  const xScale = (x: number) => margin.left + ((x - xMin) / xRange) * innerW;
  const yScale = (y: number) => margin.top + innerH - ((y - yMin) / yRange) * innerH;

  const actualPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.actual)}`).join(' ');
  const cfPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.counterfactual)}`).join(' ');
  const opportunityCost =
    `M ${xScale(points[0]!.x)} ${yScale(points[0]!.actual)} ` +
    points.map((p) => `L ${xScale(p.x)} ${yScale(p.actual)}`).join(' ') +
    ' ' +
    [...points].reverse().map((p) => `L ${xScale(p.x)} ${yScale(p.counterfactual)}`).join(' ') +
    ' Z';
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * yRange);

  return (
    <div style={{ width: '100%' }}>
      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${VIEWBOX_W} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="주차별 잔액 변화 차트"
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={margin.left} x2={margin.left + innerW} y1={yScale(t)} y2={yScale(t)} stroke="#eee" />
            <text x={margin.left - 8} y={yScale(t)} fontSize={11} fill="#888" textAnchor="end" dominantBaseline="central">
              {fmtKRW(Math.round(t))}
            </text>
          </g>
        ))}
        {points.map((p) => (
          <g key={p.x}>
            <line x1={xScale(p.x)} x2={xScale(p.x)} y1={margin.top + innerH} y2={margin.top + innerH + 4} stroke="#888" />
            <text x={xScale(p.x)} y={margin.top + innerH + 18} fontSize={11} fill="#888" textAnchor="middle">
              {p.x}주
            </text>
          </g>
        ))}

        <path d={opportunityCost} fill="rgba(150,150,150,0.18)" />
        <path d={cfPath} fill="none" stroke="#a3e3a3" strokeWidth={2} strokeDasharray="4 4" />
        <path d={actualPath} fill="none" stroke="#16a34a" strokeWidth={3} />

        {points.map((p) => (
          <circle
            key={p.x}
            cx={xScale(p.x)}
            cy={yScale(p.actual)}
            r={p.expired ? 6 : p.claimed ? 5 : 3}
            fill={p.expired ? '#dc2626' : p.claimed ? '#16a34a' : '#aaa'}
            stroke="white"
            strokeWidth={2}
          />
        ))}
      </svg>

      <div
        className="row gap-3"
        style={{
          marginTop: 'var(--sp-3)',
          fontSize: '0.85rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <LegendItem color="#16a34a" label="실제" />
        <LegendItem color="#a3e3a3" label="매주 청구한다면" dashed />
        <LegendItem color="rgba(150,150,150,0.4)" label="기회비용" filled />
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed, filled }: { color: string; label: string; dashed?: boolean; filled?: boolean }) {
  return (
    <span className="row gap-2" style={{ alignItems: 'center' }}>
      {filled ? (
        <span style={{ display: 'inline-block', width: 18, height: 8, background: color, borderRadius: 2 }} />
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: 22,
            height: 0,
            borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
          }}
        />
      )}
      <span style={{ color: 'var(--text)' }}>{label}</span>
    </span>
  );
}
