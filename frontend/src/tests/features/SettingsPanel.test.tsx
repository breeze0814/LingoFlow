import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('Option + F')).toBeInTheDocument();
    expect(screen.getByText('Option + S')).toBeInTheDocument();
    expect(screen.getByText('Option + Q')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '启用DeepL API Free' }));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      providers: {
        ...DEFAULT_SETTINGS.providers,
        deepl_free: {
          ...DEFAULT_SETTINGS.providers.deepl_free,
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

  it('marks settings that are not implemented yet', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '通用' }));

    const primaryLanguageRow = screen.getByText('第一语言').closest('.settingRow');
    const detectionModeRow = screen.getByText('语种识别').closest('.settingRow');

    expect(primaryLanguageRow).not.toBeNull();
    expect(within(primaryLanguageRow as HTMLElement).queryByText('未实现')).not.toBeInTheDocument();
    expect(detectionModeRow).not.toBeNull();
    expect(within(detectionModeRow as HTMLElement).getByText('未实现')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '服务' }));

    const ocrPanelPositionRow = screen.getByText('OCR 结果面板位置').closest('.settingRow');
    const httpApiRow = screen.getByText('启用本地 HTTP API').closest('.settingRow');

    expect(ocrPanelPositionRow).not.toBeNull();
    expect(within(ocrPanelPositionRow as HTMLElement).getByText('未实现')).toBeInTheDocument();
    expect(httpApiRow).not.toBeNull();
    expect(within(httpApiRow as HTMLElement).getByText('未实现')).toBeInTheDocument();
  });

  it('renders all translate providers in tool settings', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '工具' }));

    expect(screen.getAllByText('Youdao 网页翻译').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bing 网页翻译').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DeepL API Free').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Azure Translator').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Google Cloud Translation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('腾讯云机器翻译').length).toBeGreaterThan(0);
    expect(screen.getAllByText('百度翻译开放平台').length).toBeGreaterThan(0);
  });

  it('shows provider key links for api-based translators', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '工具' }));
    fireEvent.click(screen.getByRole('button', { name: 'Azure Translator' }));

    expect(screen.getByRole('link', { name: '前往 Azure Translator 获取密钥' })).toHaveAttribute(
      'href',
    );

    fireEvent.click(screen.getByRole('button', { name: '腾讯云机器翻译' }));
    expect(screen.getByRole('link', { name: '前往腾讯云机器翻译获取密钥' })).toHaveAttribute(
      'href',
    );
  });

  it('renders top navigation beside the window title', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={vi.fn()} />);
    const tablist = screen.getByRole('tablist', { name: '设置分组' });
    expect(tablist.closest('.settingsWindowBarTabs')).not.toBeNull();
  });

  it('does not render the titlebar subtitle copy', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={vi.fn()} />);
    expect(screen.queryByText('LingoFlow Desktop · 本地配置')).not.toBeInTheDocument();
  });
});
