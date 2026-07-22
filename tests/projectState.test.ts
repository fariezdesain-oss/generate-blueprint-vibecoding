import {
  buildProjectStatePrompt,
  buildProjectContext,
  isProjectStateUseful,
  mergeProjectState,
  shouldBuildRollingSummary,
  extractJsonObject,
  updateProjectState,
  updateRollingSummary,
} from '@/lib/utils/projectState';
import { createProvider } from '@/lib/ai/provider.factory';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock provider factory
jest.mock('@/lib/ai/provider.factory', () => ({
  createProvider: jest.fn(),
}));

describe('projectState', () => {
  it('mergeProjectState menggabungkan objek tanpa menghapus nilai lama', () => {
    const current = {
      nama_proyek: 'Kasir UMKM',
      fitur: ['Login'],
      tech_stack: { frontend: 'Next.js' },
    };

    expect(mergeProjectState(current, {
      fitur: ['Checkout'],
      tech_stack: { database: 'PostgreSQL' },
    })).toEqual({
      nama_proyek: 'Kasir UMKM',
      fitur: ['Login', 'Checkout'],
      tech_stack: { frontend: 'Next.js', database: 'PostgreSQL' },
    });
  });

  it('isProjectStateUseful hanya true jika ada informasi substansial', () => {
    expect(isProjectStateUseful({})).toBe(false);
    expect(isProjectStateUseful({ nama_proyek: '' })).toBe(false);
    expect(isProjectStateUseful({ nama_proyek: 'ERP Internal' })).toBe(true);
    expect(isProjectStateUseful({ fitur: ['Login'] })).toBe(true);
  });

  it('buildProjectContext memformat state dan summary untuk prompt', () => {
    const context = buildProjectContext({ nama_proyek: 'CRM', fitur: ['Pipeline'] }, 'User memilih web app.');

    expect(context).toContain('PROJECT STATE');
    expect(context).toContain('CRM');
    expect(context).toContain('ROLLING SUMMARY');
    expect(context).toContain('User memilih web app.');
  });

  it('buildProjectStatePrompt meminta JSON diff Bahasa Indonesia', () => {
    const prompt = buildProjectStatePrompt({ fitur: ['Login'] }, [{ role: 'user', content: 'User ingin checkout dan payment gateway.' }]);

    expect(prompt).toContain('JSON');
    expect(prompt).toContain('Bahasa Indonesia');
    expect(prompt).toContain('Jangan hapus informasi lama');
    expect(prompt).toContain('checkout');
  });

  it('shouldBuildRollingSummary aktif setiap 20 pesan', () => {
    expect(shouldBuildRollingSummary(19)).toBe(false);
    expect(shouldBuildRollingSummary(20)).toBe(true);
    expect(shouldBuildRollingSummary(40)).toBe(true);
  });

  describe('extractJsonObject', () => {
    it('should extract valid JSON object from text', () => {
      const text = 'Here is the JSON: {"nama_proyek": "test"} and some trailing text';
      expect(extractJsonObject(text)).toEqual({ nama_proyek: 'test' });
    });

    it('should handle nested JSON objects', () => {
      const text = '{"project": {"name": "Test", "features": ["A", "B"]}}';
      expect(extractJsonObject(text)).toEqual({ project: { name: 'Test', features: ['A', 'B'] } });
    });

    it('should handle escaped characters in JSON', () => {
      const text = '{"description": "He said \\"hello\\" to me"}';
      expect(extractJsonObject(text)).toEqual({ description: 'He said "hello" to me' });
    });

    it('should return empty object if no JSON found', () => {
      expect(extractJsonObject('No JSON here')).toEqual({});
    });

    it('should return empty object for invalid JSON', () => {
      expect(extractJsonObject('{"unclosed": "object"')).toEqual({});
    });
    
    it('should ignore JSON arrays and extract inner objects', () => {
      expect(extractJsonObject('[{"a": 1}]')).toEqual({"a": 1});
    });
  });

  describe('updateProjectState', () => {
    let mockSupabase: any;
    let mockGenerateChat: jest.Mock;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { project_state: { nama_proyek: 'Lama' } } }),
        update: jest.fn().mockReturnThis(),
      };

      mockGenerateChat = jest.fn();
      (createProvider as jest.Mock).mockReturnValue({
        generateChat: mockGenerateChat,
      });
    });

    it('should update project state with AI response', async () => {
      mockGenerateChat.mockResolvedValue('{"fitur": ["Baru"]}');

      await updateProjectState(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        [{ role: 'user', content: 'Tambah fitur baru' }]
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          project_state: { nama_proyek: 'Lama', fitur: ['Baru'] },
        })
      );
    });

    it('should not update if AI returns empty or invalid JSON', async () => {
      mockGenerateChat.mockResolvedValue('No JSON found');

      await updateProjectState(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        [{ role: 'user', content: 'hello' }]
      );

      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should handle case where session has no project_state', async () => {
      mockSupabase.single.mockResolvedValue({ data: { project_state: null } });
      mockGenerateChat.mockResolvedValue('{"fitur": ["Baru"]}');

      await updateProjectState(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        [{ role: 'user', content: 'Tambah fitur baru' }]
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          project_state: { fitur: ['Baru'] },
        })
      );
    });
  });

  describe('updateRollingSummary', () => {
    let mockSupabase: any;
    let mockGenerateChat: jest.Mock;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { rolling_summary: 'Ringkasan lama.' } }),
        update: jest.fn().mockReturnThis(),
      };

      mockGenerateChat = jest.fn();
      (createProvider as jest.Mock).mockReturnValue({
        generateChat: mockGenerateChat,
      });
    });

    it('should not update if messages count is not a multiple of 20', async () => {
      const messages = Array(19).fill({ role: 'user', content: 'test' });
      await updateRollingSummary(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        messages
      );

      expect(mockSupabase.select).not.toHaveBeenCalled();
    });

    it('should update rolling summary if messages count is a multiple of 20', async () => {
      const messages = Array(20).fill({ role: 'user', content: 'test' });
      mockGenerateChat.mockResolvedValue('Ringkasan baru ditambahkan.');

      await updateRollingSummary(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        messages
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rolling_summary: 'Ringkasan baru ditambahkan.',
        })
      );
    });

    it('should not update if AI returns empty string', async () => {
      const messages = Array(20).fill({ role: 'user', content: 'test' });
      mockGenerateChat.mockResolvedValue('   ');

      await updateRollingSummary(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        messages
      );

      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should handle case where session has no rolling_summary', async () => {
      mockSupabase.single.mockResolvedValue({ data: { rolling_summary: null } });
      const messages = Array(20).fill({ role: 'user', content: 'test' });
      mockGenerateChat.mockResolvedValue('Ringkasan baru pertama kali.');

      await updateRollingSummary(
        mockSupabase as unknown as SupabaseClient,
        'session-123',
        { providerName: "openai", apiKey: "test", modelName: "test" },
        messages
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rolling_summary: 'Ringkasan baru pertama kali.',
        })
      );
    });
  });
});
