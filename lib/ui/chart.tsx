/**
 * Bare SVG line chart with counterfactual overlay (T6).
 * No dependencies. Suitable for ≤30 data points.
 * uPlot integration deferred — when user count grows, swap to uPlot wrapper.
 */

export type ChartPoint = {
  x: number;
  actual: number;
  counterfactual: number;
  claimed: boolean;
  expired?: boolean;
};

export type GrowthChartProps = {
  points: ChartPoint[];
  width?: number;
  height?: number;
};

export function GrowthChart({ points, width = 600, height = 320 }: GrowthChartProps) {
  if (points.length === 0) {
    return (
      <p style={{ color: '#666', textAlign: 'center', padding: '32px' }}>
        아직 기록이 없어요. 첫 청구 후 차트가 나타납니다.
      </p>
    );
  }

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerW = width - margin.left - margin.right;
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

  // Shaded region between actual (lower) and counterfactual (upper)
  const opportunityCost =
    `M ${xScale(points[0]!.x)} ${yScale(points[0]!.actual)} ` +
    points.map((p) => `L ${xScale(p.x)} ${yScale(p.actual)}`).join(' ') +
    ' ' +
    [...points].reverse().map((p) => `L ${xScale(p.x)} ${yScale(p.counterfactual)}`).join(' ') +
    ' Z';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * yRange);

  return (
    <svg width={width} height={height} role="img" aria-label="주차별 잔액 변화 차트">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={margin.left}
            x2={margin.left + innerW}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke="#eee"
          />
          <text x={margin.left - 6} y={yScale(t)} fontSize={10} fill="#888" textAnchor="end" dominantBaseline="central">
            {Math.round(t).toLocaleString('ko-KR')}
          </text>
        </g>
      ))}
      {points.map((p) => (
        <g key={p.x}>
          <line
            x1={xScale(p.x)}
            x2={xScale(p.x)}
            y1={margin.top + innerH}
            y2={margin.top + innerH + 4}
            stroke="#888"
          />
          <text x={xScale(p.x)} y={margin.top + innerH + 16} fontSize={10} fill="#888" textAnchor="middle">
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

      <g transform={`translate(${margin.left}, ${margin.top - 8})`}>
        <rect x={0} y={-12} width={14} height={3} fill="#16a34a" />
        <text x={20} y={-8} fontSize={11} fill="#333">실제</text>
        <rect x={70} y={-12} width={14} height={3} fill="#a3e3a3" />
        <text x={90} y={-8} fontSize={11} fill="#333">매주 청구한다면</text>
        <rect x={210} y={-13} width={14} height={5} fill="rgba(150,150,150,0.4)" />
        <text x={230} y={-8} fontSize={11} fill="#333">기회비용</text>
      </g>
    </svg>
  );
}
