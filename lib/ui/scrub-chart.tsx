'use client';

import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const MAX_TICKS = 50;
const VIEWBOX_W = 720;
const VIEWBOX_H = 360;
const MARGIN = { top: 30, right: 30, bottom: 50, left: 64 };

function compoundAt(start: number, rateBp: number, ticks: number): number {
  let b = start;
  for (let i = 0; i < ticks; i += 1) b = b + Math.floor((b * rateBp) / 10000);
  return b;
}
function simpleAt(start: number, rateBp: number, ticks: number): number {
  return start + Math.floor(((start * rateBp) / 10000) * ticks);
}
function fmtKRW(n: number): string {
  if (n >= 100_000_000) return Math.round(n / 10_000_000) / 10 + '억';
  if (n >= 1_000_000) return Math.round(n / 100_000) / 10 + 'M';
  if (n >= 10_000) return Math.round(n / 1000).toLocaleString('ko-KR') + 'k';
  return n.toLocaleString('ko-KR');
}
function fmtFull(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

type Mode = 'years' | 'weeks';
type Milestone = { from: number; to: number; emoji: string; title: string; sub: string };
const MILESTONES: Milestone[] = [
  { from: 1, to: 4, emoji: '🌱', title: '거의 같아 보이지?', sub: '슬라이더를 더 오른쪽으로 끌어봐.' },
  { from: 5, to: 9, emoji: '🌿', title: '조금씩 차이가 보여', sub: '복리가 살짝 위로 나가기 시작했어.' },
  { from: 10, to: 14, emoji: '🌳', title: '와, 격차가 또렷해!', sub: '복리는 이자에도 이자가 붙어서 가팔라져.' },
  { from: 15, to: 24, emoji: '🚀', title: '복리가 단리를 추월하고 있어', sub: '단리는 매번 같은 양만, 복리는 점점 더!' },
  { from: 25, to: 34, emoji: '⚡', title: '복리가 폭발하기 시작!', sub: '시간이 충분하면 단리는 따라올 수 없어.' },
  { from: 35, to: 50, emoji: '🌌', title: '하늘로 올라가는 복리', sub: '시간이 가장 강력한 친구야. 일찍 시작할수록 좋아.' },
];

function getMilestone(t: number): Milestone {
  return MILESTONES.find((m) => t >= m.from && t <= m.to) ?? MILESTONES[0]!;
}

const PRESET_PRINCIPALS = [10_000, 50_000, 100_000, 1_000_000];
const PRESET_RATES = [5, 7, 10, 15, 20];

export function ScrubChart() {
  const [tick, setTick] = useState(8);
  const [mode, setMode] = useState<Mode>('years');
  const [principal, setPrincipal] = useState(10_000);
  const [ratePct, setRatePct] = useState(10);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const rateBp = ratePct * 100;

  const unit = mode === 'years' ? '년' : '주';
  const unitLong = mode === 'years' ? '년' : '주';

  function pickFromPointer(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = VIEWBOX_W / rect.width;
    const xInViewbox = (e.clientX - rect.left) * ratio;
    const xInPlot = xInViewbox - MARGIN.left;
    const innerW = VIEWBOX_W - MARGIN.left - MARGIN.right;
    const t = Math.round((xInPlot / innerW) * MAX_TICKS);
    setTick(Math.max(0, Math.min(MAX_TICKS, t)));
  }
  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    pickFromPointer(e);
  }
  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    pickFromPointer(e);
  }
  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  const series = useMemo(() => {
    const arr: { tick: number; simple: number; compound: number }[] = [];
    for (let t = 0; t <= MAX_TICKS; t += 1) {
      arr.push({ tick: t, simple: simpleAt(principal, rateBp, t), compound: compoundAt(principal, rateBp, t) });
    }
    return arr;
  }, [principal, rateBp]);

  const yMax = Math.max(series[series.length - 1]!.compound, principal * 2);
  const yMin = principal;

  const innerW = VIEWBOX_W - MARGIN.left - MARGIN.right;
  const innerH = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

  const xScale = (t: number) => MARGIN.left + (t / MAX_TICKS) * innerW;
  const yScale = (val: number) =>
    MARGIN.top + innerH - ((val - yMin) / Math.max(1, yMax - yMin)) * innerH;

  const compoundPath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.tick)} ${yScale(p.compound)}`)
    .join(' ');
  const simplePath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.tick)} ${yScale(p.simple)}`)
    .join(' ');

  const visibleSeries = series.filter((p) => p.tick <= tick);
  const gapPath =
    `M ${xScale(0)} ${yScale(simpleAt(principal, rateBp, 0))} ` +
    visibleSeries.map((p) => `L ${xScale(p.tick)} ${yScale(p.simple)}`).join(' ') +
    ' ' +
    [...visibleSeries].reverse().map((p) => `L ${xScale(p.tick)} ${yScale(p.compound)}`).join(' ') +
    ' Z';

  const xTicks = [0, 10, 20, 30, 40, 50];
  const yTicks = [yMin, yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75, yMax];

  const cur = series[tick]!;
  const diff = cur.compound - cur.simple;
  const diffPct = cur.simple > 0 ? Math.round(((cur.compound - cur.simple) / cur.simple) * 100) : 0;
  const milestone = getMilestone(tick);

  return (
    <div className="stack-4">
      {/* Controls */}
      <div className="card stack-3">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          <strong>🔧 조건을 바꿔봐</strong>
          <div className="row gap-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'years'}
              onClick={() => setMode('years')}
              style={{
                padding: '6px 14px',
                border: 'none',
                background: mode === 'years' ? 'var(--primary)' : 'var(--surface-2)',
                color: mode === 'years' ? 'white' : 'var(--text-muted)',
                borderRadius: 'var(--r-pill) 0 0 var(--r-pill)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              1년 단위
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'weeks'}
              onClick={() => setMode('weeks')}
              style={{
                padding: '6px 14px',
                border: 'none',
                background: mode === 'weeks' ? 'var(--primary)' : 'var(--surface-2)',
                color: mode === 'weeks' ? 'white' : 'var(--text-muted)',
                borderRadius: '0 var(--r-pill) var(--r-pill) 0',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              가상 1주 단위
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>💰 원금</div>
            <div className="amount" style={{ fontSize: '1.25rem', color: 'var(--text)' }}>
              {fmtFull(principal)}
            </div>
            <div className="row gap-1" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {PRESET_PRINCIPALS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrincipal(p)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    background: principal === p ? 'var(--experiment)' : 'var(--surface-2)',
                    color: principal === p ? 'white' : 'var(--text-muted)',
                    borderRadius: 'var(--r-pill)',
                    cursor: 'pointer',
                  }}
                >
                  {fmtKRW(p)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>📈 이자율 (매 {unit})</div>
            <div className="amount" style={{ fontSize: '1.25rem', color: 'var(--experiment-deep)' }}>
              {ratePct}%
            </div>
            <div className="row gap-1" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {PRESET_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRatePct(r)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    background: ratePct === r ? 'var(--experiment)' : 'var(--surface-2)',
                    color: ratePct === r ? 'white' : 'var(--text-muted)',
                    borderRadius: 'var(--r-pill)',
                    cursor: 'pointer',
                  }}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="soft" style={{ margin: 0, fontSize: '0.82rem' }}>
          {mode === 'years'
            ? '🔔 실제 투자 시장은 보통 1년에 5-10% 정도예요.'
            : '🔔 우리 가족 시스템은 1주에 10% — 1주가 1년인 셈! 8주 = 8년 압축.'}
        </p>
      </div>

      {/* Chart + Slider unified */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="row-between" style={{ marginBottom: 'var(--sp-3)', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          <strong>⏱ 시간을 끌어봐</strong>
          <span className="badge badge-info">{tick}{unitLong} 후</span>
        </div>
        <svg
          ref={svgRef}
          width="100%"
          height="auto"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="slider"
          aria-label="시간을 끌어서 변경"
          aria-valuemin={0}
          aria-valuemax={MAX_TICKS}
          aria-valuenow={tick}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              setTick((t) => Math.max(0, t - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              setTick((t) => Math.min(MAX_TICKS, t + 1));
            } else if (e.key === 'Home') {
              setTick(0);
            } else if (e.key === 'End') {
              setTick(MAX_TICKS);
            }
          }}
          style={{
            display: 'block',
            maxWidth: '100%',
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
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
          {xTicks.map((t) => (
            <g key={`xt-${t}`}>
              <line
                x1={xScale(t)}
                x2={xScale(t)}
                y1={MARGIN.top + innerH}
                y2={MARGIN.top + innerH + 4}
                stroke="#888"
              />
              <text
                x={xScale(t)}
                y={MARGIN.top + innerH + 18}
                fontSize={11}
                fill="#888"
                textAnchor="middle"
              >
                {t}{unit}
              </text>
            </g>
          ))}

          <path d={gapPath} fill="rgba(22,163,74,0.18)" />
          <path d={simplePath} fill="none" stroke="#94a3b8" strokeWidth={2.5} />
          <path d={compoundPath} fill="none" stroke="#16a34a" strokeWidth={3} />

          <line
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={MARGIN.top}
            y2={MARGIN.top + innerH}
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          <circle cx={xScale(tick)} cy={yScale(cur.simple)} r={6} fill="#94a3b8" stroke="white" strokeWidth={2} />
          <circle cx={xScale(tick)} cy={yScale(cur.compound)} r={7} fill="#16a34a" stroke="white" strokeWidth={2} />

          <g transform={`translate(${xScale(tick)}, ${MARGIN.top - 10})`}>
            <rect x={-30} y={-13} width={60} height={22} rx={11} fill="#2563eb" />
            <text x={0} y={4} fontSize={12} fontWeight={700} fill="white" textAnchor="middle">
              {tick}{unit} 후
            </text>
          </g>
          {/* Drag handle at bottom of indicator (clearly grabbable) */}
          <g transform={`translate(${xScale(tick)}, ${MARGIN.top + innerH})`} style={{ pointerEvents: 'none' }}>
            <circle r={11} fill="#2563eb" stroke="white" strokeWidth={3} style={{ filter: 'drop-shadow(0 2px 4px rgba(37,99,235,0.4))' }} />
            <path d="M -3 -2 L 3 -2 M -3 2 L 3 2" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        </svg>

        <p className="soft" style={{ textAlign: 'center', margin: 'var(--sp-2) 0 0', fontSize: '0.85rem' }}>
          👆 차트를 끌어서 시간을 바꿔봐 (또는 좌우 화살표 키)
        </p>

        <div className="row gap-4" style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--sp-3)', fontSize: '0.9rem' }}>
          <span className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: 24, borderTop: '3px solid #94a3b8' }} />
            <strong>단리</strong>
            <span className="muted">매{unit} 같은 이자만</span>
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

      <div className="grid-3">
        <div className="card" style={{ background: 'var(--surface-2)', borderColor: '#94a3b8' }}>
          <div className="label" style={{ color: '#475569' }}>단리</div>
          <div className="amount" style={{ fontSize: '1.6rem', color: '#475569' }}>{fmtFull(cur.simple)}</div>
          <div className="soft" style={{ marginTop: 4 }}>매{unit} +{fmtKRW(Math.floor((principal * rateBp) / 10000))}원만</div>
        </div>
        <div className="card card-tinted-experiment">
          <div className="label" style={{ color: 'var(--experiment-deep)' }}>복리</div>
          <div className="amount" style={{ fontSize: '1.6rem', color: 'var(--experiment-deep)' }}>{fmtFull(cur.compound)}</div>
          <div className="soft" style={{ marginTop: 4 }}>{ratePct}%씩 누적</div>
        </div>
        <div className="card" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderColor: '#f59e0b' }}>
          <div className="label" style={{ color: '#92400e' }}>차이</div>
          <div className="amount" style={{ fontSize: '1.6rem', color: '#92400e' }}>+{fmtFull(diff)}</div>
          <div className="soft" style={{ marginTop: 4 }}>단리보다 {diffPct}% 더</div>
        </div>
      </div>

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
