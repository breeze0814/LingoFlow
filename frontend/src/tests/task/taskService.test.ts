import { describe, expect, it, vi } from 'vitest';
import { triggerInputTranslate } from '../../features/task/taskService';
import { initialTaskState } from '../../features/task/taskReducer';

const { mockInputTranslate } = vi.hoisted(() => ({
  mockInputTranslate: vi.fn().mockResolvedValue({
    ok: true,
    task_id: 'task_1',
    status: 'success',
    data: {
      provider_id: 'openai_compatible',
      source_text: 'hello',
      translated_text: '你好',
      translation_results: [
        {
          provider_id: 'openai_compatible',
          translated_text: '你好',
        },
      ],
    },
  }),
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    inputTranslate: mockInputTranslate,
  },
}));

describe('taskService', () => {
  it('returns succeeded action on success', async () => {
    const result = await triggerInputTranslate(initialTaskState, {
      text: 'hello',
      targetLang: 'zh-CN',
    });
    expect(result.action).toBe('succeeded');
    if (result.action === 'succeeded') {
      expect(result.payload.result?.translationResults?.[0]?.providerId).toBe('openai_compatible');
    }
  });

  it('forwards enabled provider configs to tauri commands', async () => {
    await triggerInputTranslate(initialTaskState, {
      text: 'hello',
      targetLang: 'zh-CN',
      translateProviderConfigs: [
        { id: 'youdao_web' },
        { id: 'deepl_free', apiKey: 'deepl-key', baseUrl: 'https://api-free.deepl.com/v2/translate' },
      ],
    });

    expect(mockInputTranslate).toHaveBeenCalledWith({
      text: 'hello',
      targetLang: 'zh-CN',
      translateProviderConfigs: [
        { id: 'youdao_web' },
        { id: 'deepl_free', apiKey: 'deepl-key', baseUrl: 'https://api-free.deepl.com/v2/translate' },
      ],
    });
  });
});
