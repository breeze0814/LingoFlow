import { taskReducer } from '../../features/task/taskReducer';

describe('taskReducer', () => {
  it('sets success state', () => {
    const state = taskReducer('succeeded', {
      taskType: 'input_translate',
      taskId: 'task_1',
      result: {
        taskId: 'task_1',
        providerId: 'openai_compatible',
        sourceText: 'hello',
        translatedText: '你好',
      },
    });
    expect(state.status).toBe('success');
    expect(state.result?.translatedText).toBe('你好');
  });
});
