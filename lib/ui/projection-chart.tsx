'use client';

import { fmtKRWShort, fmtFullKRW } from './format';

const VIEWBOX_W = 720;
const VIEWBOX_H = 320;
const MARGIN = { top: 24, right: 28, bottom: 44, left: 64 };

function compoundAt(start: number, rateBp: number, t: number): number {
  let b = start;
  for (let i = 0; i < t; i += 1) b = b + Math.floor((b * rateBp) / 10000);
  return b;
}

export type ProjectionChartProps = {
  startingPrincipal: number;
  weeklyRateBp: number;
  totalWeeks: number;
  currentWeek: number;
  currentBalance: number;
};

export function ProjectionChart({
  startingPrincipal,
  weeklyRateBp,
  totalWeeks,
  currentWeek,
  currentBalance,
}: ProjectionChartProps) {
  const w = VIEWBOX_W - MARGIN.left - MARGIN.right;
  const h = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

  const steps = totalWeeks;
  const projected: number[] = Array.from({ length: steps + 1 }, (_, i) =>
    compoundAt(startingPrincipal, weeklyRateBp, i)
  );
  const yMax = projected[projected.length - 1] ?? startingPrincipal;
  const yMin = startingPrincipal;

  const xOf = (week: number): number => MARGIN.left + (w * week) / steps;
  const yOf = (val: number): number =>
    MARGIN.top + h - (h * (val - yMin)) / Math.max(1, yMax - yMin);

  const projPath = projected
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(v)}`)
    .join(' ');

  const clampedWeek = Math.min(steps, Math.max(0, currentWeek));
  const cx = xOf(clampedWeek);
  const cyActual = yOf(Math.min(yMax, Math.max(yMin, currentBalance)));
  const projAtNow = projected[clampedWeek] ?? startingPrincipal;
  const cyProj = yOf(projAtNow);

  const xTicks = Array.from({ length: Math.min(steps, 8) + 1 }, (_, i) =>
    Math.round((steps * i) / Math.min(steps, 8))
  );
  const yTickValues = [yMin, Math.round((yMin + yMax) / 2), yMax];

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        style={{ width: '100%', maxWidth: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="복리 예상 차트와 현재 위치"
      >
        <line x1={MARGIN.left} y1={MARGIN.top + h} x2={MARGIN.left + w} y2={MARGIN.top + h} stroke="var(--border)" />
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + h} stroke="var(--border)" />

        {yTickValues.map((v) => (
          <g key={v}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + w}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="var(--border)"
              strokeDasharray="2 4"
              opacity={0.5}
            />
            <text
              x={MARGIN.left - 8}
              y={yOf(v) + 4}
              fontSize="11"
              textAnchor="end"
              fill="var(--text-muted)"
            >
              {fmtKRWShort(v)}
            </text>
          </g>
        ))}

        {xTicks.map((t) => (
          <text
            key={t}
            x={xOf(t)}
            y={MARGIN.top + h + 18}
            fontSize="11"
            textAnchor="middle"
            fill="var(--text-muted)"
          >
            {t}주
          </text>
        ))}

        <path d={projPath} stroke="var(--experiment-deep)" strokeWidth={2.5} fill="none" />

        <line
          x1={cx}
          y1={MARGIN.top}
          x2={cx}
          y2={MARGIN.top + h}
          stroke="var(--experiment)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.7}
        />

        <circle cx={cx} cy={cyProj} r={5} fill="var(--experiment-deep)" opacity={0.4} />
        <circle cx={cx} cy={cyActual} r={7} fill="var(--experiment-deep)" stroke="white" strokeWidth={2} />

        <text
          x={cx}
          y={cyActual - 14}
          fontSize="13"
          fontWeight={700}
          textAnchor={clampedWeek > steps * 0.7 ? 'end' : 'middle'}
          fill="var(--experiment-deep)"
        >
          현재 {fmtFullKRW(currentBalance)}
        </text>
      </svg>
    </div>
  );
}
