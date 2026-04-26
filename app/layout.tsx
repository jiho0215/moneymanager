import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TopProgressBar } from '@/lib/ui/top-progress';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compound Learning System',
  description: '복리 학습 시스템 — 가족이 함께 경험하는 시간의 가치',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <TopProgressBar />
        {children}
      </body>
    </html>
  );
}
