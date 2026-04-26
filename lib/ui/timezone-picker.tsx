'use client';

import { useEffect, useState } from 'react';

export const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Asia/Seoul', label: '🇰🇷 한국 (Asia/Seoul)' },
  { value: 'America/Los_Angeles', label: '🇺🇸 미국 서부 (Los Angeles)' },
  { value: 'America/Denver', label: '🇺🇸 미국 산악 (Denver)' },
  { value: 'America/Chicago', label: '🇺🇸 미국 중부 (Chicago)' },
  { value: 'America/New_York', label: '🇺🇸 미국 동부 (New York)' },
  { value: 'Asia/Tokyo', label: '🇯🇵 일본 (Tokyo)' },
  { value: 'Asia/Singapore', label: '🇸🇬 싱가폴' },
  { value: 'Asia/Shanghai', label: '🇨🇳 중국 (Shanghai)' },
  { value: 'Australia/Sydney', label: '🇦🇺 호주 동부 (Sydney)' },
  { value: 'Europe/London', label: '🇬🇧 영국' },
  { value: 'Europe/Paris', label: '🇪🇺 유럽 중부 (Paris/Berlin)' },
  { value: 'Pacific/Auckland', label: '🇳🇿 뉴질랜드' },
];

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
}

export function TimezonePicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? 'Asia/Seoul');

  useEffect(() => {
    if (!defaultValue) {
      const detected = detectBrowserTimezone();
      const known = TIMEZONE_OPTIONS.some((o) => o.value === detected);
      setValue(known ? detected : 'Asia/Seoul');
    }
  }, [defaultValue]);

  return (
    <select name={name} value={value} onChange={(e) => setValue(e.target.value)}>
      {TIMEZONE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
