import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel } from '../../features/settings/SettingsPanel';
import { DEFAULT_SETTINGS } from '../../features/settings/settingsTypes';

describe('SettingsPanel', () => {
  it('triggers setting updates', () => {
    const onChange = vi.fn();
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '通用' }));
    fireEvent.change(screen.getByLabelText('第二语言'), { target: { value: 'ja' } });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      secondaryLanguage: 'ja',
    });
  });

  it('switches tabs and renders shortcuts content', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '快捷键' }));
    expect(screen.getByText('系统快捷键')).toBeInTheDocument();
    expect(screen.getByText('Option + A')).toBeInTheDocument();
    expect(screen.queryByLabelText('输入翻译快捷键')).not.toBeInTheDocument();
  });

  it('updates shortcut key binding', () => {
    const onChange = vi.fn();
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '快捷键' }));
    fireEvent.click(screen.getByRole('button', { name: '修改输入翻译快捷键' }));
    fireEvent.keyDown(window, { key: 'z', altKey: true });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        inputTranslate: 'Option + Z',
      },
    });
  });

  it('toggles provider from tools list', () => {
    const onChange = vi.fn();
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '启用DeepL 翻译' }));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      providers: {
        ...DEFAULT_SETTINGS.providers,
        deepLTranslate: {
          ...DEFAULT_SETTINGS.providers.deepLTranslate,
          enabled: true,
        },
      },
    });
  });

  it('updates OCR panel position', () => {
    const onChange = vi.fn();
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: '服务' }));
    fireEvent.change(screen.getByLabelText('OCR 结果面板位置'), { target: { value: 'center' } });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      ocrPanelPosition: 'center',
    });
  });
});
