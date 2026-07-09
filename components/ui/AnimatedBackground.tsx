export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-32 -left-32 size-[28rem] sm:size-[36rem] rounded-full opacity-[0.04] blur-3xl animate-orb-1"
        style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }}
      />
      <div
        className="absolute top-1/2 -right-24 size-64 rounded-full opacity-[0.03] blur-3xl animate-float"
        style={{ background: 'radial-gradient(circle, #34a853, transparent 70%)' }}
      />
    </div>
  );
}

