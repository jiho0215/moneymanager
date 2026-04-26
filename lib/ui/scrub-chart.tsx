'use client';

import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { fmtKRWShort, fmtFullKRW } from './format';

const VIEWBOX_W = 720;
const VIEWBOX_H = 380;
const MARGIN = { top: 30, right: 30, bottom: 50, left: 64 };

function piggyAt(start: number, addition: number, t: number): number {
  return start + addition * t;
}
function compoundPassiveAt(start: number, rateBp: number, t: number): number {
  let b = start;
  for (let i = 0; i < t; i += 1) b = b + Math.floor((b * rateBp) / 10000);
  return b;
}
function compoundActiveAt(start: number, addition: number, rateBp: number, t: number): number {
  let b = start;
  for (let i = 0; i < t; i += 1) {
    b = b + addition;
    b = b + Math.floor((b * rateBp) / 10000);
  }
  return b;
}
const fmtKRW = fmtKRWShort;
const fmtFull = fmtFullKRW;

type Mode = 'years' | 'weeks';
type Scenario = 'one-time' | 'regular';
type Milestone = { from: number; to: number; emoji: string; title: string; sub: string };
const MILESTONES: Milestone[] = [
  { from: 0, to: 1, emoji: '🐷', title: '아직 비슷해 보이지?', sub: '슬라이더를 더 끌어봐. 곡선이 갈라지기 시작해.' },
  { from: 2, to: 4, emoji: '🌿', title: '복리가 돼지저금통을 추월', sub: '이자에 이자가 붙어서 점점 위로!' },
  { from: 5, to: 8, emoji: '🌳', title: '꾸준히 저금하는 게 진짜 무기', sub: '능동(꾸준히)이 수동(가만히)보다 훨씬 위로 올라가.' },
  { from: 9, to: 12, emoji: '🚀', title: '셋의 격차가 또렷해!', sub: '돼지저금통은 직선, 복리는 곡선, 능동은 더 가파른 곡선.' },
  { from: 13, to: 16, emoji: '⚡', title: '능동이 폭발하기 시작', sub: '꾸준한 작은 저축 + 이자가 시간을 만나면 어마어마해.' },
  { from: 17, to: 20, emoji: '🌌', title: '시간 + 꾸준함 = 마법', sub: '일찍, 꾸준히, 오래. 이게 부의 가장 단순한 공식이야.' },
];

function getMilestone(t: number): Milestone {
  return MILESTONES.find((m) => t >= m.from && t <= m.to) ?? MILESTONES[0]!;
}

const PRESET_PRINCIPALS = [10_000, 50_000, 100_000, 1_000_000];
const PRESET_RATES = [5, 7, 10, 15, 20];
const PRESET_ADDITIONS = [0, 500, 1_000, 5_000, 10_000];
const PRESET_RANGES = [1, 5, 10, 20];

function getXTicks(max: number): number[] {
  return Array.from({ length: 6 }, (_, i) => Math.round((max * i) / 5));
}

export function ScrubChart() {
  const [tick, setTick] = useState(8);
  const [maxTicks, setMaxTicks] = useState(20);
  const [mode, setMode] = useState<Mode>('years');
  const [scenario, setScenario] = useState<Scenario>('regular');
  const [principal, setPrincipal] = useState(10_000);
  const [ratePct, setRatePct] = useState(10);
  const [addition, setAddition] = useState(1_000);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const rateBp = ratePct * 100;

  // Clamp tick when range changes
  function changeMaxTicks(newMax: number) {
    setMaxTicks(newMax);
    setTick((t) => Math.min(t, newMax));
  }

  const unit = mode === 'years' ? '년' : '주';

  function pickFromPointer(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = VIEWBOX_W / rect.width;
    const xInViewbox = (e.clientX - rect.left) * ratio;
    const xInPlot = xInViewbox - MARGIN.left;
    const innerW = VIEWBOX_W - MARGIN.left - MARGIN.right;
    const t = Math.round((xInPlot / innerW) * maxTicks);
    setTick(Math.max(0, Math.min(maxTicks, t)));
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
    const arr: { t: number; piggy: number; compound: number }[] = [];
    for (let t = 0; t <= maxTicks; t += 1) {
      if (scenario === 'one-time') {
        arr.push({
          t,
          piggy: principal, // sits flat — no addition, no interest
          compound: compoundPassiveAt(principal, rateBp, t),
        });
      } else {
        arr.push({
          t,
          piggy: piggyAt(principal, addition, t), // linear: principal + addition*t
          compound: compoundActiveAt(principal, addition, rateBp, t),
        });
      }
    }
    return arr;
  }, [principal, rateBp, addition, maxTicks, scenario]);

  const yMax = Math.max(series[series.length - 1]!.compound, principal * 2);
  const yMin = principal;

  const innerW = VIEWBOX_W - MARGIN.left - MARGIN.right;
  const innerH = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

  const xScale = (t: number) => MARGIN.left + (t / maxTicks) * innerW;
  const yScale = (val: number) =>
    MARGIN.top + innerH - ((val - yMin) / Math.max(1, yMax - yMin)) * innerH;

  const piggyPath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t)} ${yScale(p.piggy)}`).join(' ');
  const compoundPath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t)} ${yScale(p.compound)}`).join(' ');

  const xTicks = getXTicks(maxTicks);
  const yTicks = [yMin, yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75, yMax];

  const cur = series[tick]!;
  const milestone = getMilestone(tick);

  return (
    <div className="stack-4">
      {/* Scenario tabs */}
      <div className="card" style={{ padding: 'var(--sp-2)' }}>
        <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            role="tab"
            aria-selected={scenario === 'one-time'}
            onClick={() => setScenario('one-time')}
            style={{
              padding: '12px 14px',
              border: 'none',
              borderRadius: 'var(--r-md)',
              background: scenario === 'one-time' ? 'linear-gradient(135deg, #ecfdf5 0%, #fdf2f8 100%)' : 'var(--surface-2)',
              color: scenario === 'one-time' ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '0.92rem',
              fontWeight: scenario === 'one-time' ? 700 : 500,
              boxShadow: scenario === 'one-time' ? '0 0 0 2px var(--experiment) inset' : undefined,
              transition: 'all 150ms',
            }}
          >
            <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>1️⃣ 한 번 저축</div>
            <div className="soft" style={{ fontSize: '0.78rem', fontWeight: 400 }}>시드머니만 넣고 가만히</div>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scenario === 'regular'}
            onClick={() => setScenario('regular')}
            style={{
              padding: '12px 14px',
              border: 'none',
              borderRadius: 'var(--r-md)',
              background: scenario === 'regular' ? 'linear-gradient(135deg, #ecfdf5 0%, #fdf2f8 100%)' : 'var(--surface-2)',
              color: scenario === 'regular' ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '0.92rem',
              fontWeight: scenario === 'regular' ? 700 : 500,
              boxShadow: scenario === 'regular' ? '0 0 0 2px var(--experiment) inset' : undefined,
              transition: 'all 150ms',
            }}
          >
            <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>2️⃣ 꾸준히 적금</div>
            <div className="soft" style={{ fontSize: '0.78rem', fontWeight: 400 }}>매번 일정 금액 추가</div>
          </button>
        </div>
      </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-3)' }}>
          <ControlField label="💰 시작 원금" value={fmtFull(principal)} valueColor="var(--text)">
            {PRESET_PRINCIPALS.map((p) => (
              <Chip key={p} active={principal === p} onClick={() => setPrincipal(p)}>{fmtKRW(p)}</Chip>
            ))}
          </ControlField>

          <ControlField label={`📈 이자율 (매 ${unit})`} value={`${ratePct}%`} valueColor="var(--experiment-deep)">
            {PRESET_RATES.map((r) => (
              <Chip key={r} active={ratePct === r} onClick={() => setRatePct(r)}>{r}%</Chip>
            ))}
          </ControlField>

          {scenario === 'regular' && (
            <ControlField label={`💵 매 ${unit} 적금`} value={fmtFull(addition)} valueColor="#ec4899">
              {PRESET_ADDITIONS.map((a) => (
                <Chip key={a} active={addition === a} onClick={() => setAddition(a)}>{a === 0 ? '0' : fmtKRW(a)}</Chip>
              ))}
            </ControlField>
          )}

          <ControlField label={`📅 기간 (최대 ${unit})`} value={`${maxTicks}${unit}`} valueColor="var(--bonus-deep)">
            {PRESET_RANGES.map((r) => (
              <Chip key={r} active={maxTicks === r} onClick={() => changeMaxTicks(r)}>{r}{unit}</Chip>
            ))}
          </ControlField>
        </div>

        <p className="soft" style={{ margin: 0, fontSize: '0.82rem' }}>
          {mode === 'years'
            ? '🔔 실제 투자 시장은 보통 1년에 5-10%, 매년 조금씩 꾸준히 저축하는 게 핵심.'
            : '🔔 우리 가족 시스템은 1주에 10% — 1주가 1년인 셈! 8주 = 8년 압축.'}
        </p>
      </div>

      {/* Chart */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="row-between" style={{ marginBottom: 'var(--sp-2)', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          <strong>⏱ 시간을 끌어봐</strong>
          <span className="badge badge-info">{tick}{unit} 후</span>
        </div>
        <p className="soft" style={{ margin: '0 0 var(--sp-3)', fontSize: '0.85rem' }}>
          👆 차트를 끌어서 시간을 바꿔봐
        </p>

        <svg
          ref={svgRef}
          width="100%"
          height="auto"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="slider"
          aria-label="시간을 끌어서 변경"
          aria-valuemin={0}
          aria-valuemax={maxTicks}
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
              setTick((t) => Math.min(maxTicks, t + 1));
            } else if (e.key === 'Home') {
              setTick(0);
            } else if (e.key === 'End') {
              setTick(maxTicks);
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

          {/* Two lines: piggy (loser, dashed) vs compound (winner, solid thick) */}
          <path d={piggyPath} fill="none" stroke="#ec4899" strokeWidth={2.5} strokeDasharray="6 4" />
          <path d={compoundPath} fill="none" stroke="#16a34a" strokeWidth={3.5} />

          {/* Vertical indicator */}
          <line
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={MARGIN.top}
            y2={MARGIN.top + innerH}
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          {/* Dots at current tick for each line */}
          <circle cx={xScale(tick)} cy={yScale(cur.piggy)} r={6} fill="#ec4899" stroke="white" strokeWidth={2} />
          <circle cx={xScale(tick)} cy={yScale(cur.compound)} r={7} fill="#16a34a" stroke="white" strokeWidth={2.5} />

          {/* Tick badge */}
          <g transform={`translate(${xScale(tick)}, ${MARGIN.top - 10})`}>
            <rect x={-30} y={-13} width={60} height={22} rx={11} fill="#2563eb" />
            <text x={0} y={4} fontSize={12} fontWeight={700} fill="white" textAnchor="middle">
              {tick}{unit} 후
            </text>
          </g>

          {/* Drag handle at bottom of indicator */}
          <g transform={`translate(${xScale(tick)}, ${MARGIN.top + innerH})`} style={{ pointerEvents: 'none' }}>
            <circle r={11} fill="#2563eb" stroke="white" strokeWidth={3} style={{ filter: 'drop-shadow(0 2px 4px rgba(37,99,235,0.4))' }} />
            <path d="M -3 -2 L 3 -2 M -3 2 L 3 2" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        </svg>

        <div className="row gap-4" style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--sp-3)', fontSize: '0.85rem' }}>
          <span className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: 22, borderTop: '3px dashed #ec4899' }} />
            <span><strong>🐷 돼지저금통</strong> <span className="muted">{scenario === 'one-time' ? '이자 없이 그대로' : '이자 없이 적금'}</span></span>
          </span>
          <span className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: 22, borderTop: '4px solid #16a34a' }} />
            <span><strong>🌳 복리</strong> <span className="muted">{scenario === 'one-time' ? `${ratePct}%씩 자람` : `적금 + ${ratePct}% 이자`}</span></span>
          </span>
        </div>
      </div>

      {/* Live stats — 2 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-3)' }}>
        <ScenarioCard
          icon="🐷"
          tint="pink"
          label="돼지저금통"
          subtitle={
            scenario === 'one-time'
              ? '한 번 넣고 가만히'
              : `매${unit} +${fmtKRW(addition)} (이자 없음)`
          }
          amount={cur.piggy}
        />
        <ScenarioCard
          icon="🌳"
          tint="active"
          label="복리"
          subtitle={
            scenario === 'one-time'
              ? `한 번 넣고 ${ratePct}%씩 자람`
              : `매${unit} +${fmtKRW(addition)} & ${ratePct}%씩`
          }
          amount={cur.compound}
          highlight
        />
      </div>

      {/* Multiplier vs piggy */}
      {cur.piggy > 0 && cur.compound > cur.piggy && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #ecfdf5 100%)',
            borderColor: 'var(--experiment)',
            textAlign: 'center',
          }}
        >
          <div className="soft" style={{ marginBottom: 4 }}>복리 vs 돼지저금통</div>
          <div className="amount" style={{ fontSize: '1.5rem', color: 'var(--experiment-deep)' }}>
            <strong>{(cur.compound / cur.piggy).toFixed(2)}배</strong> 차이!
          </div>
          <div className="soft" style={{ marginTop: 4 }}>
            +{fmtFull(cur.compound - cur.piggy)} 더
          </div>
        </div>
      )}

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

function ControlField({
  label,
  value,
  valueColor,
  children,
}: {
  label: string;
  value: string;
  valueColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="amount" style={{ fontSize: '1.15rem', color: valueColor }}>{value}</div>
      <div className="row gap-1" style={{ marginTop: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: '0.78rem',
        fontWeight: 600,
        border: 'none',
        background: active ? 'var(--experiment)' : 'var(--surface-2)',
        color: active ? 'white' : 'var(--text-muted)',
        borderRadius: 'var(--r-pill)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function ScenarioCard({
  icon,
  tint,
  label,
  subtitle,
  amount,
  highlight,
}: {
  icon: string;
  tint: 'pink' | 'passive' | 'active';
  label: string;
  subtitle: string;
  amount: number;
  highlight?: boolean;
}) {
  const styles = {
    pink: { bg: '#fdf2f8', border: '#ec4899', text: '#9d174d' },
    passive: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
    active: { bg: '#dcfce7', border: '#16a34a', text: 'var(--experiment-deep)' },
  } as const;
  const s = styles[tint];
  return (
    <div
      className="card"
      style={{
        background: s.bg,
        borderColor: s.border,
        borderWidth: highlight ? 2 : 1,
        boxShadow: highlight ? '0 8px 24px rgba(22,163,74,0.18)' : undefined,
        position: 'relative',
      }}
    >
      <div className="row-between" style={{ marginBottom: 6 }}>
        <span className="label" style={{ color: s.text }}>{label}</span>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      </div>
      <div className="amount" style={{ fontSize: '1.4rem', color: s.text }}>{fmtFull(amount)}</div>
      <div className="soft" style={{ marginTop: 4, fontSize: '0.78rem' }}>{subtitle}</div>
      {highlight && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: 12,
            background: 'var(--experiment)',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 'var(--r-pill)',
            letterSpacing: '0.04em',
          }}
        >
          🏆 가장 큰
        </div>
      )}
    </div>
  );
}
