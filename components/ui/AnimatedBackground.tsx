export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-primary">
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-20" />
      <div className="absolute left-[8%] top-[12%] size-24 sm:size-32 border-2 border-subtle bg-gemini-blue opacity-60 dark:bg-gemini-purple dark:bg-opacity-20 dark:border-gemini-purple dark:shadow-[4px_4px_0_var(--gemini-purple)]" />
      <div className="absolute right-[12%] top-[22%] size-20 sm:size-28 border-2 border-[var(--border-hover)] bg-gemini-red opacity-50 dark:bg-gemini-orange dark:bg-opacity-20 dark:border-gemini-orange dark:shadow-[4px_4px_0_var(--gemini-orange)]" />
      <div className="absolute bottom-[10%] right-[7%] size-28 sm:size-40 border-2 border-subtle bg-gemini-green opacity-45 dark:bg-gemini-green dark:bg-opacity-20 dark:border-gemini-green dark:shadow-[4px_4px_0_var(--gemini-green)]" />
    </div>
  );
}
