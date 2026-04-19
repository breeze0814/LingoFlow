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

/**
 * Converts a logical drag selection in the overlay viewport to physical screen coordinates
 * for capturing the selected region.
 *
 * This function handles the coordinate transformation from:
 * - Logical viewport coordinates (CSS pixels in the overlay window)
 * - To physical screen coordinates (actual pixels on the monitor)
 *
 * The transformation accounts for:
 * 1. Monitor position offset (multi-monitor setups)
 * 2. Scale factor differences between logical and physical pixels
 * 3. Viewport size vs monitor size ratios
 *
 * @param selection - The drag selection in logical viewport coordinates
 * @param monitor - The monitor's physical position and size
 * @param viewport - The overlay viewport's logical size
 * @returns Physical capture rectangle in screen coordinates
 *
 * @example
 * ```ts
 * const selection = { startX: 100, startY: 100, endX: 300, endY: 200 };
 * const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
 * const viewport = { width: 960, height: 540 }; // 2x scale factor
 * const rect = buildPhysicalCaptureRect(selection, monitor, viewport);
 * // Returns: { x: 200, y: 200, width: 400, height: 200 }
 * ```
 */
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
