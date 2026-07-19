'use client';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AnimatedBackground />
      <div className="fixed right-4 top-4 z-50 w-auto">
        <ThemeToggle compact />
      </div>
      {children}
    </>
  );
}
