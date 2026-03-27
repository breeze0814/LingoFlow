import { commandsClient } from '../../infra/tauri/commands';
import { TaskType } from './taskTypes';

type TaskReporterInput = {
  action: 'triggered' | 'succeeded' | 'failed' | 'cancelled';
  payload: {
    taskType: TaskType;
    error?: { message?: string };
    result?: { recognizedText?: string };
  };
};

function isOcrTask(taskType: TaskType): boolean {
  return taskType === 'ocr_recognize' || taskType === 'ocr_translate';
}

function tryPrintToTerminal(message: string) {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    void commandsClient.debugPrint({ message });
  }
}

export function reportTask(next: TaskReporterInput) {
  const taskType = next.payload.taskType;
  if (!isOcrTask(taskType)) {
    return;
  }

  if (next.action === 'failed') {
    const message = `[task:${taskType}] ERROR: ${next.payload.error?.message ?? '未知错误'}`;
    console.error(message);
    tryPrintToTerminal(message);
    return;
  }
  if (next.action === 'cancelled') {
    const message = `[task:${taskType}] CANCELLED`;
    console.log(message);
    tryPrintToTerminal(message);
    return;
  }
  if (next.action !== 'succeeded') {
    return;
  }

  if (!next.payload.result?.recognizedText) {
    return;
  }
  const message = `[task:${taskType}] OCR: ${next.payload.result.recognizedText}`;
  console.log(message);
  tryPrintToTerminal(message);
}
