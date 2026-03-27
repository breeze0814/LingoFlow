import { AppError, TaskAction, TaskResult, TaskState, TaskType } from './taskTypes';

export const initialTaskState: TaskState = {
  taskId: null,
  taskType: null,
  status: 'idle',
  result: null,
  error: null,
};

type TaskPayload = {
  taskType: TaskType;
  taskId: string;
  result?: TaskResult;
  error?: AppError;
};

export function taskReducer(action: TaskAction, payload: TaskPayload): TaskState {
  if (action === 'triggered') {
    return {
      ...initialTaskState,
      taskType: payload.taskType,
      taskId: payload.taskId,
      status: 'pending',
    };
  }

  if (action === 'succeeded') {
    return {
      taskType: payload.taskType,
      taskId: payload.taskId,
      status: 'success',
      result: payload.result ?? null,
      error: null,
    };
  }

  if (action === 'failed') {
    return {
      taskType: payload.taskType,
      taskId: payload.taskId,
      status: 'failure',
      result: null,
      error: payload.error ?? null,
    };
  }

  return {
    taskType: payload.taskType,
    taskId: payload.taskId,
    status: 'cancelled',
    result: null,
    error: payload.error ?? null,
  };
}
