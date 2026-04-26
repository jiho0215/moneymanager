import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Compound Learning System',
  description: '복리 학습 시스템 — 가족이 함께 경험하는 시간의 가치',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif',
          margin: 0,
          padding: 0,
          backgroundColor: '#fafafa',
          color: '#1a1a1a',
        }}
      >
        {children}
      </body>
    </html>
  );
}
