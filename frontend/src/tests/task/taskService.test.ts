import { describe, expect, it, vi } from 'vitest';
import { triggerInputTranslate } from '../../features/task/taskService';
import { initialTaskState } from '../../features/task/taskReducer';

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    inputTranslate: vi.fn().mockResolvedValue({
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
});
