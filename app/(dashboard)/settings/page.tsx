import { ProviderSelector } from '@/components/ui/ProviderSelector';

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-8">
        <h1 className="text-gradient text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-tertiary">Konfigurasi provider AI</p>
      </div>
      <ProviderSelector />
    </div>
  );
}
