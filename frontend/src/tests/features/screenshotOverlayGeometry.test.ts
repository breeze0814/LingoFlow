import { buildPhysicalCaptureRect } from '../../features/screenshot/screenshotOverlayGeometry';

describe('screenshotOverlayGeometry', () => {
  it('maps logical drag selection into physical screen coordinates', () => {
    expect(
      buildPhysicalCaptureRect(
        { startX: 10, startY: 20, endX: 110, endY: 70 },
        { x: 1920, y: 0, width: 1800, height: 1200 },
        { width: 1200, height: 800 },
      ),
    ).toEqual({
      x: 1935,
      y: 30,
      width: 150,
      height: 75,
    });
  });

  it('normalizes reverse drag directions', () => {
    expect(
      buildPhysicalCaptureRect(
        { startX: 110, startY: 70, endX: 10, endY: 20 },
        { x: 0, y: 1080, width: 1920, height: 1080 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({
      x: 10,
      y: 1100,
      width: 100,
      height: 50,
    });
  });

  it('uses viewport to physical ratio instead of raw scale factor assumptions', () => {
    expect(
      buildPhysicalCaptureRect(
        { startX: 100, startY: 50, endX: 300, endY: 150 },
        { x: 2560, y: 0, width: 2560, height: 1440 },
        { width: 2000, height: 1120 },
      ),
    ).toEqual({
      x: 2688,
      y: 64,
      width: 256,
      height: 129,
    });
  });
});
