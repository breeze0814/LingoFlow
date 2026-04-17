import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSelectionWorkflowOutcome } from '../../features/selection/selectionWorkflow';

const { mockReadSelectionText } = vi.hoisted(() => ({
  mockReadSelectionText: vi.fn(),
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    readSelectionText: mockReadSelectionText,
  },
}));

const LABELS = {
  sourceLanguageCode: 'en',
  sourceLanguageLabel: '英语',
  targetLanguageCode: 'zh-CN',
  targetLanguageLabel: '简体中文',
};

describe('selectionWorkflow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockReadSelectionText.mockReset();
  });

  it('opens a prefilled workspace from selected text', async () => {
    mockReadSelectionText.mockResolvedValue({ selectedText: '  selected text  ' });

    await expect(
      resolveSelectionWorkflowOutcome(
        {
          autoQueryOnSelection: true,
          defaultTranslateProvider: 'youdao_web',
          keepResultForSelection: true,
        },
        LABELS,
      ),
    ).resolves.toEqual({
      kind: 'show_payload',
      payload: expect.objectContaining({
        initialText: 'selected text',
        autoTranslate: true,
      }),
    });
  });

  it('reuses cached result when no selection is available and keep-result is enabled', async () => {
    mockReadSelectionText.mockRejectedValue({
      code: 'no_selection',
      message: '未检测到选中文本',
      retryable: false,
    });
    window.localStorage.setItem(
      'lingoflow.ocr_result.workspace.v2',
      JSON.stringify({
        autoTranslate: false,
        initialText: 'cached text',
        mode: 'input_translate',
        sourceLanguageCode: 'en',
        sourceLanguageLabel: '英语',
        targetLanguageCode: 'zh-CN',
        targetLanguageLabel: '简体中文',
      }),
    );

    await expect(
      resolveSelectionWorkflowOutcome(
        {
          autoQueryOnSelection: false,
          defaultTranslateProvider: 'youdao_web',
          keepResultForSelection: true,
        },
        LABELS,
      ),
    ).resolves.toEqual({ kind: 'show_cached' });
  });

  it('shows an explicit error payload when selection is missing and no cache should be kept', async () => {
    mockReadSelectionText.mockRejectedValue({
      code: 'no_selection',
      message: '未检测到选中文本',
      retryable: false,
    });

    await expect(
      resolveSelectionWorkflowOutcome(
        {
          autoQueryOnSelection: false,
          defaultTranslateProvider: 'youdao_web',
          keepResultForSelection: false,
        },
        LABELS,
      ),
    ).resolves.toEqual({
      kind: 'show_payload',
      payload: expect.objectContaining({
        initialErrorMessage: '未检测到选中文本',
      }),
    });
  });
});
