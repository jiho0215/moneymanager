'use client';

import { useMemo, useState } from 'react';
import { ScrubChart } from '@/lib/ui/scrub-chart';
import { saveParentRecommendations } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

const PRINCIPAL_PRESETS = [5000, 10000, 50000, 100000];
const RATE_PRESETS = [3, 5, 7, 10, 13];
const WEEKS_PRESETS = [4, 8, 12];

type Scenario = 'one-time' | 'regular';

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

export function ParentWizard({ accountId, kidName }: { accountId: string; kidName: string }) {
  const [step, setStep] = useState(1);
  const [principal, setPrincipal] = useState(10000);
  const [scenario, setScenario] = useState<Scenario>('one-time');
  const [weeks, setWeeks] = useState(8);
  const [ratePct, setRatePct] = useState(10);

  const totalSteps = 5;
  const projected = useMemo(() => {
    let b = principal;
    for (let i = 0; i < weeks; i += 1) b = b + Math.floor((b * ratePct * 100) / 10000);
    return b;
  }, [principal, weeks, ratePct]);

  return (
    <div className="stack-5">
      <header style={{ textAlign: 'center' }}>
        <div className="label" style={{ marginBottom: 6 }}>
          🌱 {kidName} 통장 설정
        </div>
        <h1 className="h2" style={{ margin: 0 }}>
          {step === 1 && '얼마로 시작할까요?'}
          {step === 2 && '저금은 어떻게 하나요?'}
          {step === 3 && '주간 이자는 몇 %?'}
          {step === 4 && '몇 주 동안 키울까요?'}
          {step === 5 && '미리보기'}
        </h1>
        <ProgressBar step={step} totalSteps={totalSteps} />
      </header>

      {step === 1 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>
            자녀에게 추천할 시작 원금이에요. 자녀가 본인 의지로 더 적게/많게 바꿀 수 있어요.
          </p>
          <ChipGrid
            items={PRINCIPAL_PRESETS}
            value={principal}
            onChange={setPrincipal}
            format={fmt}
          />
          <CustomInput value={principal} onChange={setPrincipal} unit="원" min={1000} step={1000} />
        </section>
      )}

      {step === 2 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>두 가지 방식이 있어요.</p>
          <div className="stack-3">
            <ScenarioCard
              active={scenario === 'one-time'}
              onClick={() => setScenario('one-time')}
              title="1️⃣ 한 번 저축"
              subtitle="시드머니만 한 번에 넣고 끝까지 키우기. 추가 입금 없음 (또는 자녀가 자발적으로만)."
            />
            <ScenarioCard
              active={scenario === 'regular'}
              onClick={() => setScenario('regular')}
              title="2️⃣ 꾸준히 적금"
              subtitle="시드머니 + 매주 추가로 입금하기. 매주 일정 금액을 보호자가 또는 자녀가 넣어요."
            />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>
            이건 가상 은행이 자녀에게 매주 주는 이자에요. 자녀는 이 비율을 못 바꿔요.
            <br />
            <span className="soft" style={{ fontSize: '0.85rem' }}>
              💡 추천: 10% — 1주가 1년인 셈으로 압축돼서 8주에 약 2배가 돼요.
            </span>
          </p>
          <ChipGrid
            items={RATE_PRESETS}
            value={ratePct}
            onChange={setRatePct}
            format={(n) => `${n}%`}
          />
        </section>
      )}

      {step === 4 && (
        <section className="card stack-4">
          <p className="muted" style={{ margin: 0 }}>
            한 사이클이 몇 주 동안 진행되는지에요. 자녀가 짧은 사이클로 시작하고 싶다면 더 적게 골라도 돼요.
          </p>
          <ChipGrid
            items={WEEKS_PRESETS}
            value={weeks}
            onChange={setWeeks}
            format={(n) => `${n}주`}
          />
        </section>
      )}

      {step === 5 && (
        <section className="stack-4">
          <div className="card stack-2">
            <h2 className="h3" style={{ margin: 0 }}>📋 설정 요약</h2>
            <SummaryRow label="시작 원금" value={fmt(principal)} />
            <SummaryRow
              label="저금 방식"
              value={scenario === 'one-time' ? '1️⃣ 한 번 저축' : '2️⃣ 꾸준히 적금'}
            />
            <SummaryRow label="주간 이자" value={`${ratePct}% / 주`} />
            <SummaryRow label="기간" value={`${weeks}주`} />
            <SummaryRow
              label={`${weeks}주 후 예상`}
              value={fmt(projected)}
              highlight
            />
          </div>
          <ScrubChart
            initialPrincipal={principal}
            initialRatePct={ratePct}
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
            확정하면 자녀가 로그인했을 때 통장 시작 화면이 보여요. 자녀는 이 추천을 기본값으로 보지만 본인 선택으로 바꿀 수 있어요.
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
          <form action={saveParentRecommendations}>
            <input type="hidden" name="accountId" value={accountId} />
            <input type="hidden" name="startingCapital" value={principal} />
            <input type="hidden" name="scenario" value={scenario} />
            <input type="hidden" name="totalWeeks" value={weeks} />
            <input type="hidden" name="ratePct" value={ratePct} />
            <SubmitButton variant="success" pendingText="저장 중...">
              ✅ 자녀에게 전달하기
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
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
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
          }}
        >
          {format(it)}
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
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
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
      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 4 }}>{title}</div>
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
