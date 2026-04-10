import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    mockInputTranslate.mockReset();
    mockInputTranslate.mockResolvedValue({
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
    });
  });

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
        {
          id: 'deepl_free',
          apiKey: 'deepl-key',
          baseUrl: 'https://api-free.deepl.com/v2/translate',
        },
      ],
    });

    expect(mockInputTranslate).toHaveBeenCalledWith({
      text: 'hello',
      targetLang: 'zh-CN',
      translateProviderConfigs: [
        { id: 'youdao_web' },
        {
          id: 'deepl_free',
          apiKey: 'deepl-key',
          baseUrl: 'https://api-free.deepl.com/v2/translate',
        },
      ],
    });
  });

  it('returns triggered action when command is accepted', async () => {
    mockInputTranslate.mockResolvedValueOnce({
      ok: true,
      task_id: 'task_pending',
      status: 'accepted',
      data: null,
    });

    const result = await triggerInputTranslate(initialTaskState, {
      text: 'hello',
      targetLang: 'zh-CN',
    });

    expect(result).toEqual({
      action: 'triggered',
      payload: {
        taskType: 'input_translate',
        taskId: 'task_pending',
      },
    });
  });

  it('returns cancelled action when command is cancelled', async () => {
    mockInputTranslate.mockResolvedValueOnce({
      ok: false,
      task_id: 'task_cancelled',
      status: 'cancelled',
      data: null,
      error: null,
    });

    const result = await triggerInputTranslate(initialTaskState, {
      text: 'hello',
      targetLang: 'zh-CN',
    });

    expect(result).toEqual({
      action: 'cancelled',
      payload: {
        taskType: 'input_translate',
        taskId: 'task_cancelled',
      },
    });
  });

  it('maps unknown command exceptions to failed action', async () => {
    mockInputTranslate.mockRejectedValueOnce('network exploded');

    const result = await triggerInputTranslate(initialTaskState, {
      text: 'hello',
      targetLang: 'zh-CN',
    });

    expect(result).toEqual({
      action: 'failed',
      payload: {
        taskType: 'input_translate',
        taskId: expect.any(String),
        error: {
          code: 'internal_error',
          message: 'Unknown error',
          retryable: true,
        },
      },
    });
  });

  it('does not reuse previous taskId when command throws', async () => {
    mockInputTranslate.mockRejectedValueOnce(new Error('network exploded'));

    const result = await triggerInputTranslate(
      {
        ...initialTaskState,
        taskId: 'task_existing',
        taskType: 'input_translate',
        status: 'pending',
      },
      {
        text: 'hello',
        targetLang: 'zh-CN',
      },
    );

    expect(result.action).toBe('failed');
    if (result.action === 'failed') {
      expect(result.payload.taskId).not.toBe('task_existing');
    }
  });
});
