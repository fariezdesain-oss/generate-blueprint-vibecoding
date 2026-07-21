'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Play, Power, Trash2, Wand2 } from 'lucide-react';

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
  const [showFormModal, setShowFormModal] = useState(false);

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
        setShowFormModal(false);
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
    setShowFormModal(true);
  };

  const cancelEdit = () => {
    setEditingProviderId(null);
    setEditingMaskedKey('');
    setForm({ ...EMPTY_FORM });
    setShowFormModal(false);
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
      <div className="flex flex-1 items-center justify-center py-12">
        <Wand2 className="size-6 animate-wand-swing text-gemini-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {notification && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4">
          <div className={`animate-fade-in-up mx-4 w-full max-w-sm brutal-card !rounded-none p-6 sm:p-8 text-center !shadow-[6px_6px_0_var(--border)] ${
            notification.type === 'success'
              ? 'border-emerald-500'
              : 'border-gemini-red'
          }`}>
            <div className={`mx-auto mb-4 flex size-14 items-center justify-center !rounded-none border-2 border-border ${
              notification.type === 'success' ? 'bg-emerald-500/20' : 'bg-gemini-red/20'
            }`}>
              {notification.type === 'success' ? (
                <svg className="size-7 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="size-7 text-[#111] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h3 className="mb-2 text-xl font-black uppercase tracking-widest text-primary text-center">
              {notification.type === 'success' ? 'Berhasil' : 'Gagal'}
            </h3>
            <div className="mx-auto mb-6 mt-2 h-[2px] w-16 bg-border" />
            <p className={`mb-6 text-sm font-bold ${notification.type === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-gemini-red'}`}>
              {notification.message}
            </p>
            <button
              onClick={() => setNotification(null)}
              className={`w-full !rounded-none border-2 border-border py-2.5 sm:py-3 text-sm font-black uppercase text-white transition-all duration-200 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] ${
                notification.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gemini-red hover:bg-gemini-red/90'
              }`}
            >
              OK
            </button>
          </div>
        </div>,
        document.body
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-primary">Configured Providers</h2>
          <button
            onClick={() => {
              setEditingProviderId(null);
              setForm({ ...EMPTY_FORM });
              setEditingMaskedKey('');
              setShowFormModal(true);
            }}
            className="brutal-button !rounded-none !min-h-10 px-4 py-2 text-xs font-bold uppercase"
          >
            <span className="flex items-center gap-2">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Provider
            </span>
          </button>
        </div>

        {providers.length === 0 && (
          <p className="text-sm text-tertiary">
            No providers configured yet. Add one below.
          </p>
        )}

        <div className="space-y-4">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`brutal-card !rounded-none flex flex-col md:flex-row md:items-center justify-between px-4 py-4 sm:px-6 sm:py-5 !shadow-[4px_4px_0_var(--border)] ${
                p.is_active ? 'border-gemini-blue !shadow-[4px_4px_0_var(--gemini-blue)]' : ''
              }`}
            >
                <div className="mb-4 md:mb-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-black text-lg text-primary uppercase tracking-wide">
                      {PROVIDER_OPTIONS.find((o) => o.value === p.provider_name)?.label ||
                        p.provider_name}
                    </span>
                    {p.is_active && (
                      <span className="!rounded-none border-2 border-border bg-gemini-blue px-2 py-0.5 text-[10px] font-black text-white shadow-[2px_2px_0_var(--border)]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="border-l-4 border-gemini-orange pl-3 py-1 bg-tertiary/50 mt-2">
                    <p className="text-xs font-bold text-secondary">
                      MODEL: <span className="font-mono font-medium text-primary">{p.model_name}</span>
                    </p>
                    {p.context_level && (
                      <p className="text-[11px] font-bold text-secondary mt-1">
                        MODE: <span className="font-mono font-medium text-primary">{p.context_level.toUpperCase()} CONTEXT</span>
                      </p>
                    )}
                    <p className="mt-1 text-[11px] font-bold text-secondary">
                      KEY: <span className="font-mono font-medium text-primary select-none" onCopy={preventSecretCopy} onCut={preventSecretCopy} onContextMenu={preventSecretCopy}>
                        {p.masked_api_key || (p.has_api_key ? 'Tersimpan di server' : 'Belum disimpan')}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 !rounded-none border-2 border-border bg-secondary px-3 py-2 text-xs font-bold uppercase text-primary transition-all duration-200 hover:bg-tertiary shadow-[2px_2px_0_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--border)]"
                  >
                    <Pencil className="size-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleTestSaved(p.id)}
                    disabled={testingProviderId === p.id}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 !rounded-none border-2 border-border bg-gemini-orange px-3 py-2 text-xs font-black uppercase text-[#111] transition-all duration-200 hover:bg-gemini-orange/90 shadow-[2px_2px_0_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--border)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingProviderId === p.id ? (
                      <Wand2 className="size-3.5 animate-wand-swing" />
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        <span>Test</span>
                      </>
                    )}
                  </button>
                {!p.is_active && (
                  <button
                    onClick={() => handleActivate(p.id)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 !rounded-none border-2 border-border bg-gemini-blue px-3 py-2 text-xs font-black uppercase text-white transition-all duration-200 hover:bg-gemini-blue/90 shadow-[2px_2px_0_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--border)]"
                  >
                    <Power className="size-3.5" />
                    <span>Aktifkan</span>
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 !rounded-none border-2 border-border bg-gemini-red px-3 py-2 text-xs font-black uppercase text-white transition-all duration-200 hover:bg-gemini-red/90 shadow-[2px_2px_0_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--border)]"
                >
                    <Trash2 className="size-3.5" />
                    <span>Hapus</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showFormModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4">
          <div className="animate-fade-in-up w-full max-w-lg brutal-card !rounded-none bg-secondary p-6 sm:p-8 !shadow-[6px_6px_0_var(--border)] overflow-y-auto max-h-[90vh]">
            <h3 className="mb-2 text-xl font-black uppercase tracking-widest text-primary text-center">
              {editingProviderId ? 'Edit Provider' : 'Add Provider'}
            </h3>
            <div className="mx-auto mb-6 mt-2 h-[2px] w-16 bg-border" />

            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-secondary">Provider</label>
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
                <label className="mb-1.5 block text-sm font-bold text-secondary">Model</label>
                <input
                  type="text"
                  value={form.model_name}
                  onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  placeholder="Ketik nama model secara manual (contoh: gemini-2.5-flash, dll)"
                  required
                  className="input-gemini"
                />
              </div>

              {form.provider_name === 'custom' && (
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-secondary">Base URL</label>
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
                <label className="mb-1.5 block text-sm font-bold text-secondary">API Key</label>
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

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 pt-4 border-t-2 border-border">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 !rounded-none border-2 border-border py-2.5 sm:py-3 text-sm font-bold uppercase text-secondary transition-all duration-200 hover:bg-tertiary shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => testConnection()}
                  disabled={!form.api_key || !form.model_name || testing || saving}
                  className="flex items-center justify-center gap-2 flex-1 !rounded-none border-2 border-border bg-gemini-orange py-2.5 sm:py-3 text-sm font-black uppercase text-[#111] transition-all duration-200 hover:bg-gemini-orange/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0_var(--border)]"
                >
                  {testing ? (
                    <><Wand2 size={16} className="animate-wand-swing" /> Testing...</>
                  ) : (
                    'Test'
                  )}
                </button>
                <button
                  type="submit"
                  disabled={!form.model_name || (!editingProviderId && !form.api_key) || saving || testing}
                  className="flex items-center justify-center gap-2 flex-1 !rounded-none border-2 border-border bg-gemini-blue py-2.5 sm:py-3 text-sm font-black uppercase text-white transition-all duration-200 hover:bg-gemini-blue/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0_var(--border)]"
                >
                  {saving ? (
                    <><Wand2 size={16} className="animate-wand-swing" /> Menyimpan...</>
                  ) : (
                    'Simpan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deleteTargetId && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm brutal-card !rounded-none p-6 sm:p-8 text-center !shadow-[6px_6px_0_var(--border)]">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center !rounded-none bg-gemini-red border-2 border-border">
              <svg className="size-7 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-black uppercase tracking-widest text-primary text-center">Hapus Provider</h3>
            <div className="mx-auto mb-6 mt-2 h-[2px] w-16 bg-border" />
            <p className="mb-6 text-sm text-secondary">Anda yakin ingin menghapus provider ini?</p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 !rounded-none border-2 border-border py-2.5 text-sm font-bold uppercase text-secondary transition-all duration-200 hover:bg-tertiary shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
              >
                Tidak
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 !rounded-none border-2 border-border bg-gemini-red py-2.5 text-sm font-black uppercase text-white transition-all duration-200 hover:bg-gemini-red/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
