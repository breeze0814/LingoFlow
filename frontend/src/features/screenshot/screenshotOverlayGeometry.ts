import { CaptureRect } from '../task/taskTypes';

type DragSelection = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type MonitorOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

function normalizeRange(start: number, end: number) {
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

export function buildPhysicalCaptureRect(
  selection: DragSelection,
  monitor: MonitorOrigin,
  viewport: ViewportSize,
): CaptureRect {
  const horizontal = normalizeRange(selection.startX, selection.endX);
  const vertical = normalizeRange(selection.startY, selection.endY);
  const widthRatio = monitor.width / viewport.width;
  const heightRatio = monitor.height / viewport.height;

  return {
    x: Math.round(monitor.x + horizontal.start * widthRatio),
    y: Math.round(monitor.y + vertical.start * heightRatio),
    width: Math.round((horizontal.end - horizontal.start) * widthRatio),
    height: Math.round((vertical.end - vertical.start) * heightRatio),
  };
}
