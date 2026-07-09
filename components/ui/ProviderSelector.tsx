'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Play, Power, Trash2 } from 'lucide-react';

interface ProviderItem {
  id: string;
  provider_name: string;
  model_name: string;
  has_api_key?: boolean;
  masked_api_key?: string;
  base_url?: string;
  context_level?: 'low' | 'medium' | 'high';
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
const CLIENT_TEST_TIMEOUT_MS = 22000;

export function ProviderSelector() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, model_name: '' });
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editingMaskedKey, setEditingMaskedKey] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchingRef = useRef(false);
  const fetchProviders = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const testConnection = async (providerId?: string): Promise<boolean> => {
    setTesting(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLIENT_TEST_TIMEOUT_MS);
    try {
      const body = providerId ? { provider_id: providerId } : form;
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await res.json();
      if (json.success) {
        setNotification({ type: 'success', message: json.data.message });
        return true;
      } else {
        setNotification({ type: 'error', message: json.error?.message || 'Gagal terhubung' });
        return false;
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'Test koneksi melebihi batas waktu. Periksa API key/model atau coba provider lain.'
        : 'Gagal menghubungi server';
      setNotification({ type: 'error', message });
      return false;
    } finally {
      clearTimeout(timeout);
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

    const endpoint = editingProviderId ? `/api/providers/${editingProviderId}` : '/api/providers';
    const method = editingProviderId ? 'PUT' : 'POST';
    const payload = editingProviderId && !form.api_key.trim()
      ? { model_name: form.model_name, base_url: form.base_url }
      : form;

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
        if (!editingProviderId) {
          await fetch(`/api/providers/${savedProvider.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true }),
          });
        }
        await fetchProviders();
        notifyProviderChanged();
        setForm({ ...EMPTY_FORM });
        setEditingProviderId(null);
        setEditingMaskedKey('');
      }
    }

    setSaving(false);
  };

  const handleEdit = (p: ProviderItem) => {
    setForm({
      provider_name: p.provider_name,
      model_name: p.model_name,
      api_key: '',
      base_url: p.base_url || '',
    });
    setEditingProviderId(p.id);
    setEditingMaskedKey(p.masked_api_key || '');
  };

  const cancelEdit = () => {
    setEditingProviderId(null);
    setEditingMaskedKey('');
    setForm({ ...EMPTY_FORM });
  };

  const preventSecretCopy = (e: React.SyntheticEvent) => {
    e.preventDefault();
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

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await fetch(`/api/providers/${deleteTargetId}`, { method: 'DELETE' });
    await fetchProviders();
    notifyProviderChanged();
    setDeleteTargetId(null);
  };

  const cancelDelete = () => setDeleteTargetId(null);

  if (pageLoading && providers.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="size-6 rounded-full border-2 border-subtle border-t-gemini-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className={`animate-fade-in-up mx-4 w-full max-w-sm glass rounded-2xl p-5 sm:p-6 text-center shadow-2xl ${
            notification.type === 'success'
              ? 'border-emerald-500/20'
              : 'border-red-500/20'
          }`}>
            <div className={`mx-auto mb-3 sm:mb-4 flex size-12 sm:size-14 items-center justify-center rounded-full ring-1 ${
              notification.type === 'success' ? 'bg-emerald-500/10 ring-emerald-500/20' : 'bg-red-500/10 ring-red-500/20'
            }`}>
              {notification.type === 'success' ? (
                <svg className="size-5 sm:size-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="size-5 sm:size-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <p className={`text-xs sm:text-sm ${notification.type === 'success' ? 'text-emerald-300' : 'text-secondary'}`}>
              {notification.message}
            </p>
            <button
              onClick={() => setNotification(null)}
              className={`mt-4 sm:mt-5 w-full rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white transition-all duration-200 ${
                notification.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-primary">Configured Providers</h2>

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
                  {p.context_level && (
                    <p className="mt-1 text-[11px] text-tertiary">
                      Generate mode: <span className="font-medium text-secondary">{p.context_level.toUpperCase()} CONTEXT</span>
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-tertiary">
                    API Key:{' '}
                    <span
                      className="select-none font-mono"
                      onCopy={preventSecretCopy}
                      onCut={preventSecretCopy}
                      onContextMenu={preventSecretCopy}
                    >
                      {p.masked_api_key || (p.has_api_key ? 'Tersimpan di server' : 'Belum disimpan')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="rounded-xl border border-subtle px-1.5 sm:px-2.5 py-1.5 md:py-1.5 text-[11px] sm:text-xs font-medium text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-secondary"
                  >
                    <Pencil className="size-3 sm:size-3.5 sm:hidden" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button
                    onClick={() => handleTestSaved(p.id)}
                    disabled={testingProviderId === p.id}
                    className="rounded-xl border border-subtle px-1.5 sm:px-2.5 py-1.5 md:py-1.5 text-[11px] sm:text-xs font-medium text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-secondary disabled:opacity-30"
                  >
                    {testingProviderId === p.id ? (
                      <span className="size-3 sm:size-3.5 rounded-full border-2 border-subtle border-t-gemini-blue animate-spin" />
                    ) : (
                      <>
                        <Play className="size-3 sm:size-3.5 sm:hidden" />
                        <span className="hidden sm:inline">Test</span>
                      </>
                    )}
                  </button>
                {!p.is_active && (
                  <button
                    onClick={() => handleActivate(p.id)}
                    className="rounded-xl bg-gradient-to-r from-gemini-blue to-gemini-blue px-1.5 sm:px-2.5 lg:px-3 py-1.5 md:py-1.5 text-[11px] sm:text-xs font-medium text-white transition-all duration-200 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  >
                    <Power className="size-3 sm:size-3.5 sm:hidden" />
                    <span className="hidden sm:inline">Activate</span>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                    className="rounded-xl bg-red-500/10 px-1.5 sm:px-2.5 lg:px-3 py-1.5 md:py-1.5 text-[11px] sm:text-xs font-medium text-red-400 transition-all duration-200 hover:bg-red-500/20 border border-red-500/20"
                >
                    <Trash2 className="size-3 sm:size-3.5 sm:hidden" />
                    <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 card-gemini p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-primary">
            {editingProviderId ? 'Edit Provider' : 'Add Provider'}
          </h2>
          {editingProviderId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-subtle px-3 py-1.5 text-xs font-medium text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-secondary"
            >
              Cancel
            </button>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-secondary">Provider</label>
          <select
            value={form.provider_name}
            onChange={(e) => setForm({ ...EMPTY_FORM, provider_name: e.target.value })}
            disabled={!!editingProviderId}
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
          {editingProviderId && editingMaskedKey && (
            <p
              className="mb-2 select-none font-mono text-xs text-tertiary"
              onCopy={preventSecretCopy}
              onCut={preventSecretCopy}
              onContextMenu={preventSecretCopy}
            >
              API key tersimpan: {editingMaskedKey}
            </p>
          )}
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder={editingProviderId ? 'Kosongkan jika hanya ingin mengubah model/base URL' : 'Masukkan API key'}
            required={!editingProviderId}
            className="input-gemini"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!form.model_name || (!editingProviderId && !form.api_key) || saving || testing}
            className="btn-gradient flex-1 py-2.5 sm:py-3 text-sm font-semibold"
          >
            {saving ? 'Saving...' : editingProviderId ? 'Save Changes & Test' : 'Save & Test Connection'}
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

      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm glass rounded-2xl p-4 sm:p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <svg className="size-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-primary">Hapus Provider</h3>
            <p className="mb-6 text-sm text-secondary">Anda yakin ingin menghapus provider ini?</p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 rounded-xl border border-subtle py-2.5 text-sm font-medium text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                Tidak
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-red-400"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
