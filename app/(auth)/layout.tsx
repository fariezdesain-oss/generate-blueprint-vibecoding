'use client';

import { ThemeProvider } from 'next-themes';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark">
      {children}
    </ThemeProvider>
  );
}
