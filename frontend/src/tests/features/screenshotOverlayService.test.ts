import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const monitor = {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  };
  let existingWindow: MockOverlayWindow | null = null;
  let readyListener: ((event: unknown) => void) | null = null;

  const emitTo = vi.fn().mockResolvedValue(undefined);
  const listen = vi.fn().mockImplementation(async (_eventName, handler) => {
    readyListener = handler;
    return () => undefined;
  });

  const setExistingWindow = (window: MockOverlayWindow | null) => {
    existingWindow = window;
  };

  class MockOverlayWindow {
    label: string;

    constructor(label: string) {
      this.label = label;
      setExistingWindow(this);
    }

    static async getByLabel(label: string) {
      if (!existingWindow || existingWindow.label !== label) {
        return null;
      }
      return existingWindow;
    }

    once(event: string, callback: () => void) {
      if (event === 'tauri://created') {
        queueMicrotask(callback);
      }
      return Promise.resolve(() => undefined);
    }

    async setSize() {
      return undefined;
    }

    async setPosition() {
      return undefined;
    }

    async show() {
      return undefined;
    }

    async setFocus() {
      return undefined;
    }
  }

  return {
    monitor,
    emitTo,
    listen,
    MockOverlayWindow,
    clearExistingWindow() {
      existingWindow = null;
    },
    emitReadyEvent() {
      readyListener?.({ payload: { ready: true } });
    },
    reset() {
      existingWindow = null;
      readyListener = null;
      emitTo.mockClear();
      listen.mockClear();
    },
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: mocks.emitTo,
  listen: mocks.listen,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'resolve_cursor_monitor') {
      return Promise.resolve(mocks.monitor);
    }
    return Promise.resolve(undefined);
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  LogicalSize: class {
    constructor(
      public width: number,
      public height: number,
    ) {}
  },
  PhysicalPosition: class {
    constructor(
      public x: number,
      public y: number,
    ) {}
  },
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: mocks.MockOverlayWindow,
}));

async function settleEventLoop() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function waitUntilReadyListenerBound() {
  await vi.waitFor(() => {
    expect(mocks.listen).toHaveBeenCalledTimes(1);
  });
}

describe('screenshotOverlayService', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.reset();
    window.localStorage.clear();
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
  });

  it('waits for a new ready event after overlay window recreation', async () => {
    const { showScreenshotOverlay } =
      await import('../../features/screenshot/screenshotOverlayService');
    const request = {
      mode: 'ocr_translate' as const,
      sourceLanguageLabel: '英语',
      sourceLangHint: 'en',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
      targetLang: 'zh-CN',
    };

    const firstOpen = showScreenshotOverlay(request);
    await waitUntilReadyListenerBound();
    expect(mocks.emitTo).toHaveBeenCalledTimes(0);
    mocks.emitReadyEvent();
    await firstOpen;
    expect(mocks.emitTo).toHaveBeenCalledTimes(1);

    mocks.emitTo.mockClear();
    mocks.clearExistingWindow();

    const secondOpen = showScreenshotOverlay(request);
    await settleEventLoop();
    expect(mocks.emitTo).toHaveBeenCalledTimes(0);
    mocks.emitReadyEvent();
    await secondOpen;
    expect(mocks.emitTo).toHaveBeenCalledTimes(1);
  });
});
