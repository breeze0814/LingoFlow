import { TaskStatus } from './taskTypes';

type TaskStatusBarProps = {
  status: TaskStatus;
};

export function TaskStatusBar({ status }: TaskStatusBarProps) {
  const statusLabel =
    status === 'idle'
      ? '空闲'
      : status === 'collecting_input'
        ? '等待输入'
        : status === 'pending'
          ? '处理中'
          : status === 'success'
            ? '已完成'
            : status === 'failure'
              ? '失败'
              : '已取消';

  return <div className="statusBar">当前状态：{statusLabel}</div>;
}
