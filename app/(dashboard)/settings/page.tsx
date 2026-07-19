import { ProviderSelector } from '@/components/ui/ProviderSelector';

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-xs sm:text-sm text-tertiary">Konfigurasi provider AI</p>
      </div>
      <ProviderSelector />
    </div>
  );
}
