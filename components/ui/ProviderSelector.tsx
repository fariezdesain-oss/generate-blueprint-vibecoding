'use client';

import { useEffect, useState } from 'react';

interface ProviderItem {
  id: string;
  provider_name: string;
  model_name: string;
  api_key?: string;
  base_url?: string;
  is_active: boolean;
}

const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'custom', label: 'OpenAI Compatible' },
];

const EMPTY_FORM = { provider_name: 'gemini', api_key: '', model_name: '', base_url: '' };

export function ProviderSelector() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, model_name: '' });
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchingRef = { current: false };
  const fetchProviders = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch('/api/providers');
      const json = await res.json();
      if (json.success) setProviders(json.data.providers);
    } catch {
      // ignore
    } finally {
      setPageLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const testConnection = async (providerId?: string): Promise<boolean> => {
    setTesting(true);
    try {
      const body = providerId ? { provider_id: providerId } : form;
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setNotification({ type: 'success', message: json.data.message });
        return true;
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Gagal terhubung' });
        return false;
      }
    } catch {
      setNotification({ type: 'error', message: 'Gagal menghubungi server' });
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleTestSaved = async (id: string) => {
    if (testingProviderId) return;
    setTestingProviderId(id);
    setNotification(null);
    await testConnection(id);
    setTestingProviderId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotification(null);

    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    if (!json.success) {
      setNotification({ type: 'error', message: json.error?.message || 'Gagal menyimpan' });
      setSaving(false);
      return;
    }

    const savedProvider = json.data?.provider;
    await fetchProviders();

    if (savedProvider?.id) {
      const ok = await testConnection(savedProvider.id);
      if (ok) {
        await fetch(`/api/providers/${savedProvider.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
        await fetchProviders();
        notifyProviderChanged();
        setForm({ ...EMPTY_FORM });
      }
    }

    setSaving(false);
  };

  const handleEdit = (p: ProviderItem) => {
    setForm({
      provider_name: p.provider_name,
      model_name: p.model_name,
      api_key: p.api_key || '',
      base_url: p.base_url || '',
    });
  };

  const notifyProviderChanged = () => {
    window.dispatchEvent(new CustomEvent('provider-changed'));
  };

  const handleActivate = async (id: string) => {
    await fetch(`/api/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    await fetchProviders();
    notifyProviderChanged();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/providers/${id}`, { method: 'DELETE' });
    await fetchProviders();
    notifyProviderChanged();
  };

  if (pageLoading && providers.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="size-6 rounded-full border-2 border-subtle border-t-gemini-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className={`animate-fade-in-up mx-4 w-full max-w-sm glass rounded-2xl p-6 text-center shadow-2xl ${
            notification.type === 'success'
              ? 'border-emerald-500/20'
              : 'border-red-500/20'
          }`}>
            <div className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full ring-1 ${
              notification.type === 'success' ? 'bg-emerald-500/10 ring-emerald-500/20' : 'bg-red-500/10 ring-red-500/20'
            }`}>
              {notification.type === 'success' ? (
                <svg className="size-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="size-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <p className={`text-sm ${notification.type === 'success' ? 'text-emerald-300' : 'text-secondary'}`}>
              {notification.message}
            </p>
            <button
              onClick={() => setNotification(null)}
              className={`mt-5 w-full rounded-xl py-2.5 text-sm font-medium text-white transition-all duration-200 ${
                notification.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Configured Providers</h2>

        {providers.length === 0 && (
          <p className="text-sm text-tertiary">
            No providers configured yet. Add one below.
          </p>
        )}

        <div className="space-y-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`card-gemini flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 ${
                p.is_active ? 'card-gemini-active' : ''
              }`}
            >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">
                      {PROVIDER_OPTIONS.find((o) => o.value === p.provider_name)?.label ||
                        p.provider_name}
                    </span>
                    {p.is_active && (
                      <span className="rounded-full bg-gradient-to-r from-gemini-blue/20 to-gemini-blue/20 px-2 py-0.5 text-[10px] font-medium text-gemini-blue">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-tertiary">
                    Model: {p.model_name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="rounded-xl border border-subtle px-3 py-1.5 text-xs font-medium text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTestSaved(p.id)}
                    disabled={testingProviderId === p.id}
                    className="rounded-xl border border-subtle px-3 py-1.5 text-xs font-medium text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-secondary disabled:opacity-30"
                  >
                    {testingProviderId === p.id ? 'Testing...' : 'Test'}
                  </button>
                {!p.is_active && (
                  <button
                    onClick={() => handleActivate(p.id)}
                    className="rounded-xl bg-gradient-to-r from-gemini-blue to-gemini-blue px-4 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  >
                    Activate
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="rounded-xl bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400 transition-all duration-200 hover:bg-red-500/20 border border-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 card-gemini p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-primary">Add Provider</h2>

        <div>
          <label className="mb-1.5 block text-sm text-secondary">Provider</label>
          <select
            value={form.provider_name}
            onChange={(e) => setForm({ ...EMPTY_FORM, provider_name: e.target.value })}
            className="input-gemini"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-secondary">Model</label>
          <input
            type="text"
            value={form.model_name}
            onChange={(e) => setForm({ ...form, model_name: e.target.value })}
            placeholder="Ketik nama model secara manual (contoh: gemini-2.5-flash, gpt-4o, dll)"
            required
            className="input-gemini"
          />
        </div>

        {form.provider_name === 'custom' && (
          <div>
            <label className="mb-1.5 block text-sm text-secondary">Base URL</label>
            <input
              type="text"
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="input-gemini"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm text-secondary">API Key</label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="sk-..."
            required
            className="input-gemini"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!form.api_key || !form.model_name || saving || testing}
            className="btn-gradient flex-1 py-2.5 sm:py-3 text-sm font-semibold"
          >
            {saving ? 'Saving...' : 'Save & Test Connection'}
          </button>
          <button
            type="button"
            onClick={() => testConnection()}
            disabled={!form.api_key || !form.model_name || testing || saving}
            className="rounded-xl border border-subtle px-4 py-2.5 sm:px-6 sm:py-3 text-sm font-medium text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary disabled:opacity-30"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <span className="size-4 rounded-full border-2 border-subtle border-t-gemini-blue animate-spin" />
                Testing...
              </span>
            ) : (
              'Test'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
