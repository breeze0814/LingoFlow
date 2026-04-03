export type TaskStatus =
  | 'idle'
  | 'collecting_input'
  | 'pending'
  | 'success'
  | 'failure'
  | 'cancelled';

export type TaskType =
  | 'selection_translate'
  | 'input_translate'
  | 'ocr_recognize'
  | 'ocr_translate'
  | 'open_input_panel';

export type TaskResult = {
  taskId: string;
  providerId: string;
  sourceText: string;
  translatedText?: string;
  recognizedText?: string;
  translationResults?: ProviderTranslationResult[];
  captureRect?: CaptureRect;
};

export type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProviderTranslationResult = {
  providerId: string;
  translatedText?: string;
  error?: AppError;
};

export type AppError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type TaskState = {
  taskId: string | null;
  taskType: TaskType | null;
  status: TaskStatus;
  result: TaskResult | null;
  error: AppError | null;
};

export type TaskAction = 'triggered' | 'succeeded' | 'failed' | 'cancelled';
