'use client';

import { useMemo, useState } from 'react';

const STARTING = 10000;
const RATE = 0.10; // 10% per "year" (= 1 week in app's compressed time)
const MAX_YEARS = 50;
const VIEWBOX_W = 720;
const VIEWBOX_H = 360;
const MARGIN = { top: 30, right: 30, bottom: 50, left: 64 };

function compoundAt(years: number): number {
  let b = STARTING;
  for (let i = 0; i < years; i += 1) b = b + Math.floor((b * 1000) / 10000);
  return b;
}
function simpleAt(years: number): number {
  return STARTING + Math.floor(STARTING * RATE * years);
}
function fmtKRW(n: number): string {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10).toLocaleString('ko-KR') + 'M';
  if (n >= 10_000) return Math.round(n / 1000).toLocaleString('ko-KR') + 'k';
  return n.toLocaleString('ko-KR');
}
function fmtFull(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

type Milestone = { from: number; to: number; emoji: string; title: string; sub: string };
const MILESTONES: Milestone[] = [
  { from: 1, to: 4,  emoji: '🌱', title: '거의 같아 보이지?', sub: '슬라이더를 더 오른쪽으로 끌어봐.' },
  { from: 5, to: 9,  emoji: '🌿', title: '조금씩 차이가 보여', sub: '복리가 살짝 위로 나가기 시작했어.' },
  { from: 10, to: 14, emoji: '🌳', title: '와, 격차가 또렷해!', sub: '복리는 이자에도 이자가 붙어서 가팔라져.' },
  { from: 15, to: 24, emoji: '🚀', title: '복리가 단리를 추월하고 있어', sub: '단리는 매년 같은 양만, 복리는 점점 더!' },
  { from: 25, to: 34, emoji: '⚡', title: '복리가 폭발하기 시작!', sub: '시간이 충분하면 단리는 따라올 수 없어.' },
  { from: 35, to: 50, emoji: '🌌', title: '하늘로 올라가는 복리', sub: '시간이 가장 강력한 친구야. 일찍 시작할수록 좋아.' },
];

function getMilestone(year: number): Milestone {
  return MILESTONES.find((m) => year >= m.from && year <= m.to) ?? MILESTONES[0]!;
}

export function ScrubChart() {
  const [years, setYears] = useState(8);

  const series = useMemo(() => {
    const arr: { year: number; simple: number; compound: number }[] = [];
    for (let y = 0; y <= MAX_YEARS; y += 1) {
      arr.push({ year: y, simple: simpleAt(y), compound: compoundAt(y) });
    }
    return arr;
  }, []);

  const yMax = series[series.length - 1]!.compound;
  const yMin = STARTING;

  const innerW = VIEWBOX_W - MARGIN.left - MARGIN.right;
  const innerH = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

  const xScale = (yr: number) => MARGIN.left + (yr / MAX_YEARS) * innerW;
  const yScale = (val: number) =>
    MARGIN.top + innerH - ((val - yMin) / (yMax - yMin)) * innerH;

  const compoundPath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.year)} ${yScale(p.compound)}`)
    .join(' ');
  const simplePath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.year)} ${yScale(p.simple)}`)
    .join(' ');

  // Filled gap between simple (lower) and compound (upper) up to current year
  const visibleSeries = series.filter((p) => p.year <= years);
  const gapPath =
    `M ${xScale(0)} ${yScale(simpleAt(0))} ` +
    visibleSeries.map((p) => `L ${xScale(p.year)} ${yScale(p.simple)}`).join(' ') +
    ' ' +
    [...visibleSeries].reverse().map((p) => `L ${xScale(p.year)} ${yScale(p.compound)}`).join(' ') +
    ' Z';

  const yearsTicks = [0, 10, 20, 30, 40, 50];
  const yTicks = [yMin, yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75, yMax];

  const cur = series[years]!;
  const diff = cur.compound - cur.simple;
  const diffPct = cur.simple > 0 ? Math.round(((cur.compound - cur.simple) / cur.simple) * 100) : 0;
  const milestone = getMilestone(years);

  return (
    <div className="stack-4">
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          border: '1px solid var(--border)',
        }}
      >
        <svg
          width="100%"
          height="auto"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="단리와 복리 비교 차트"
          style={{ display: 'block', maxWidth: '100%' }}
        >
          {/* Grid */}
          {yTicks.map((t, i) => (
            <g key={`yt-${i}`}>
              <line x1={MARGIN.left} x2={MARGIN.left + innerW} y1={yScale(t)} y2={yScale(t)} stroke="#eee" />
              <text
                x={MARGIN.left - 8}
                y={yScale(t)}
                fontSize={11}
                fill="#888"
                textAnchor="end"
                dominantBaseline="central"
              >
                {fmtKRW(Math.round(t))}
              </text>
            </g>
          ))}
          {yearsTicks.map((y) => (
            <g key={`xt-${y}`}>
              <line
                x1={xScale(y)}
                x2={xScale(y)}
                y1={MARGIN.top + innerH}
                y2={MARGIN.top + innerH + 4}
                stroke="#888"
              />
              <text
                x={xScale(y)}
                y={MARGIN.top + innerH + 18}
                fontSize={11}
                fill="#888"
                textAnchor="middle"
              >
                {y}년
              </text>
            </g>
          ))}

          {/* Filled gap */}
          <path d={gapPath} fill="rgba(22,163,74,0.18)" />

          {/* Curves */}
          <path d={simplePath} fill="none" stroke="#94a3b8" strokeWidth={2.5} />
          <path d={compoundPath} fill="none" stroke="#16a34a" strokeWidth={3} />

          {/* Current year vertical indicator */}
          <line
            x1={xScale(years)}
            x2={xScale(years)}
            y1={MARGIN.top}
            y2={MARGIN.top + innerH}
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          {/* Current year dots */}
          <circle cx={xScale(years)} cy={yScale(cur.simple)} r={6} fill="#94a3b8" stroke="white" strokeWidth={2} />
          <circle cx={xScale(years)} cy={yScale(cur.compound)} r={7} fill="#16a34a" stroke="white" strokeWidth={2} />

          {/* Year label at top of indicator */}
          <g transform={`translate(${xScale(years)}, ${MARGIN.top - 10})`}>
            <rect x={-22} y={-12} width={44} height={20} rx={10} fill="#2563eb" />
            <text x={0} y={3} fontSize={11} fontWeight={700} fill="white" textAnchor="middle">
              {years}년
            </text>
          </g>
        </svg>

        {/* Legend */}
        <div className="row gap-4" style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--sp-3)', fontSize: '0.9rem' }}>
          <span className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: 24, borderTop: '3px solid #94a3b8' }} />
            <strong>단리</strong>
            <span className="muted">매년 같은 이자만</span>
          </span>
          <span className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: 24, borderTop: '3px solid #16a34a' }} />
            <strong>복리</strong>
            <span className="muted">이자에 이자가 붙음</span>
          </span>
          <span className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: 18, height: 8, background: 'rgba(22,163,74,0.3)', borderRadius: 2 }} />
            <strong>복리의 보너스</strong>
          </span>
        </div>
      </div>

      {/* Slider */}
      <div className="card stack-3">
        <div className="row-between">
          <strong>⏱ 시간을 끌어봐</strong>
          <span className="badge badge-info">{years}년 후</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_YEARS}
          step={1}
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
          aria-label="년 수 선택"
          style={{
            width: '100%',
            height: 40,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
        <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>0년</span>
          <span>10년</span>
          <span>20년</span>
          <span>30년</span>
          <span>40년</span>
          <span>50년</span>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid-3">
        <div
          className="card"
          style={{
            background: 'var(--surface-2)',
            borderColor: '#94a3b8',
          }}
        >
          <div className="label" style={{ color: '#475569' }}>단리</div>
          <div className="amount" style={{ fontSize: '1.6rem', color: '#475569' }}>{fmtFull(cur.simple)}</div>
          <div className="soft" style={{ marginTop: 4 }}>매년 +1,000원만</div>
        </div>
        <div
          className="card card-tinted-experiment"
        >
          <div className="label" style={{ color: 'var(--experiment-deep)' }}>복리</div>
          <div className="amount" style={{ fontSize: '1.6rem', color: 'var(--experiment-deep)' }}>{fmtFull(cur.compound)}</div>
          <div className="soft" style={{ marginTop: 4 }}>10%씩 누적</div>
        </div>
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderColor: '#f59e0b',
          }}
        >
          <div className="label" style={{ color: '#92400e' }}>차이</div>
          <div className="amount" style={{ fontSize: '1.6rem', color: '#92400e' }}>+{fmtFull(diff)}</div>
          <div className="soft" style={{ marginTop: 4 }}>단리보다 {diffPct}% 더</div>
        </div>
      </div>

      {/* Milestone narrative */}
      <div
        key={milestone.title}
        className="card fade-in"
        style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #dbeafe 100%)',
          borderColor: 'var(--experiment)',
          textAlign: 'center',
          padding: 'var(--sp-5)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--sp-2)' }}>{milestone.emoji}</div>
        <div className="h2" style={{ marginBottom: 'var(--sp-2)' }}>{milestone.title}</div>
        <div className="muted" style={{ fontSize: '0.95rem' }}>{milestone.sub}</div>
      </div>
    </div>
  );
}
