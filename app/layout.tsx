import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThenAct — Decision Control Plane',
  description:
    'A deterministic authorization layer between AI intent and real-world action.',
  openGraph: {
    title: 'ThenAct',
    description: 'Think first. Then act.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
