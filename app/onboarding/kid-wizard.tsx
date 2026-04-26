'use client';

import { useMemo, useState } from 'react';
import { ScrubChart } from '@/lib/ui/scrub-chart';
import { saveKidChoices } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

const PRINCIPAL_PRESETS = [5000, 10000, 50000, 100000];
const WEEKS_PRESETS = [4, 8, 12];

type Scenario = 'one-time' | 'regular';

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

export function KidWizard({
  accountId,
  kidName,
  recommendedStartingCapital,
  recommendedScenario,
  recommendedTotalWeeks,
  weeklyRatePct,
}: {
  accountId: string;
  kidName: string;
  recommendedStartingCapital: number;
  recommendedScenario: Scenario;
  recommendedTotalWeeks: number;
  weeklyRatePct: number;
}) {
  const [step, setStep] = useState(1);
  const [principal, setPrincipal] = useState(recommendedStartingCapital);
  const [scenario, setScenario] = useState<Scenario>(recommendedScenario);
  const [weeks, setWeeks] = useState(recommendedTotalWeeks);

  const totalSteps = 4;
  const projected = useMemo(() => {
    let b = principal;
    for (let i = 0; i < weeks; i += 1) b = b + Math.floor((b * weeklyRatePct * 100) / 10000);
    return b;
  }, [principal, weeks, weeklyRatePct]);

  return (
    <div className="stack-5">
      <header style={{ textAlign: 'center' }}>
        <div className="label" style={{ marginBottom: 6 }}>
          🌱 {kidName}, 통장 만들기
        </div>
        <h1 className="h2" style={{ margin: 0 }}>
          {step === 1 && '얼마로 시작할까?'}
          {step === 2 && '저금 방식 골라보자'}
          {step === 3 && '몇 주 동안 키울래?'}
          {step === 4 && '확인하고 시작!'}
        </h1>
        <ProgressBar step={step} totalSteps={totalSteps} />
      </header>

      {step === 1 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>
            🎁 보호자가 추천한 시작 원금:{' '}
            <strong style={{ color: 'var(--experiment-deep)' }}>
              {fmt(recommendedStartingCapital)}
            </strong>
            <br />
            네가 더 많이 또는 더 적게 시작해도 돼.
          </p>
          <ChipGrid
            items={Array.from(new Set([...PRINCIPAL_PRESETS, recommendedStartingCapital])).sort((a, b) => a - b)}
            value={principal}
            onChange={setPrincipal}
            format={fmt}
            recommended={recommendedStartingCapital}
          />
          <CustomInput value={principal} onChange={setPrincipal} unit="원" min={1000} step={1000} />
        </section>
      )}

      {step === 2 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>
            🎁 보호자 추천:{' '}
            <strong>
              {recommendedScenario === 'one-time' ? '1️⃣ 한 번 저축' : '2️⃣ 꾸준히 적금'}
            </strong>
          </p>
          <div className="stack-3">
            <ScenarioCard
              active={scenario === 'one-time'}
              recommended={recommendedScenario === 'one-time'}
              onClick={() => setScenario('one-time')}
              title="1️⃣ 한 번 저축"
              subtitle="시드머니만 한 번 넣고 끝까지 키우기. 나중에 더 넣을 수도 있어."
            />
            <ScenarioCard
              active={scenario === 'regular'}
              recommended={recommendedScenario === 'regular'}
              onClick={() => setScenario('regular')}
              title="2️⃣ 꾸준히 적금"
              subtitle="시드머니 + 매주 추가로 넣기. 더 빨리 자라."
            />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>
            🎁 보호자 추천:{' '}
            <strong style={{ color: 'var(--experiment-deep)' }}>{recommendedTotalWeeks}주</strong>
          </p>
          <ChipGrid
            items={Array.from(new Set([...WEEKS_PRESETS, recommendedTotalWeeks])).sort((a, b) => a - b)}
            value={weeks}
            onChange={setWeeks}
            format={(n) => `${n}주`}
            recommended={recommendedTotalWeeks}
          />
          <p className="soft" style={{ margin: 0, fontSize: '0.82rem' }}>
            💡 1주 = 1년처럼 시간이 압축된 가상 은행이에요.
          </p>
        </section>
      )}

      {step === 4 && (
        <section className="stack-4">
          <div className="card stack-2">
            <h2 className="h3" style={{ margin: 0 }}>📋 내 통장 시작</h2>
            <SummaryRow label="시작 원금" value={fmt(principal)} />
            <SummaryRow
              label="저금 방식"
              value={scenario === 'one-time' ? '1️⃣ 한 번 저축' : '2️⃣ 꾸준히 적금'}
            />
            <SummaryRow label="주간 이자" value={`${weeklyRatePct}% / 주`} />
            <SummaryRow label="기간" value={`${weeks}주`} />
            <SummaryRow label={`${weeks}주 후 예상`} value={fmt(projected)} highlight />
          </div>
          <ScrubChart
            initialPrincipal={principal}
            initialRatePct={weeklyRatePct}
            initialMode="weeks"
            initialMaxTicks={weeks}
            initialAddition={0}
            initialScenario={scenario}
            initialTick={weeks}
            hideScenarioTabs
            hideControls
            hideBreakdown
            hideMilestone
          />
          <p className="muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
            확인 누르면 통장이 바로 시작되고, 7일 뒤부터 첫 청구할 수 있어!
          </p>
        </section>
      )}

      <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
        <button
          type="button"
          className="btn btn-subtle"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          ← 이전
        </button>
        {step < totalSteps ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
          >
            다음 →
          </button>
        ) : (
          <form action={saveKidChoices}>
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="startingCapital" value={principal} />
            <input type="hidden" name="scenario" value={scenario} />
            <input type="hidden" name="totalWeeks" value={weeks} />
            <SubmitButton variant="success" pendingText="시작 중...">
              🚀 통장 시작하기
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${totalSteps}, 1fr)`,
        gap: 4,
        marginTop: 'var(--sp-3)',
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          style={{
            height: 6,
            background: i < step ? 'var(--experiment)' : 'var(--surface-2)',
            borderRadius: 'var(--r-pill)',
          }}
        />
      ))}
    </div>
  );
}

function ChipGrid<T extends number>({
  items,
  value,
  onChange,
  format,
  recommended,
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  recommended?: T;
}) {
  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
      {items.map((it) => (
        <button
          key={it}
          type="button"
          onClick={() => onChange(it)}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: 'var(--r-pill)',
            background: value === it ? 'var(--experiment)' : 'var(--surface-2)',
            color: value === it ? 'white' : 'var(--text)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            position: 'relative',
          }}
        >
          {format(it)}
          {recommended === it && (
            <span
              style={{
                marginLeft: 6,
                fontSize: '0.7rem',
                opacity: 0.85,
              }}
            >
              🎁
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function CustomInput({
  value,
  onChange,
  unit,
  min,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  min: number;
  step: number;
}) {
  return (
    <label className="field" style={{ margin: 0, fontSize: '0.92rem' }}>
      직접 입력
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        style={{ marginTop: 4 }}
      />
      <span className="soft" style={{ fontSize: '0.82rem' }}>{unit}</span>
    </label>
  );
}

function ScenarioCard({
  active,
  recommended,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  recommended: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 'var(--sp-4)',
        border: 'none',
        borderRadius: 'var(--r-md)',
        background: active ? 'var(--experiment-bg)' : 'var(--surface-2)',
        boxShadow: active ? '0 0 0 2px var(--experiment) inset' : undefined,
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 4 }}>
        {title}
        {recommended && (
          <span style={{ marginLeft: 6, fontSize: '0.78rem', color: 'var(--experiment-deep)' }}>
            🎁 추천
          </span>
        )}
      </div>
      <div className="soft" style={{ fontSize: '0.88rem' }}>{subtitle}</div>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="row-between" style={{ fontSize: '0.95rem', padding: '4px 0' }}>
      <span className="muted">{label}</span>
      <strong style={{ color: highlight ? 'var(--experiment-deep)' : 'var(--text)' }}>{value}</strong>
    </div>
  );
}
