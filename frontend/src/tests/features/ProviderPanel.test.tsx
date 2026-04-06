import { render, screen, within } from '@testing-library/react';
import { ProviderPanel } from '../../features/settings/ProviderPanel';
import { DEFAULT_TOOL_PROVIDERS } from '../../features/settings/settingsTypes';

describe('ProviderPanel', () => {
  it('renders api provider rows with glyph icons and hides local ocr settings', () => {
    render(<ProviderPanel providers={DEFAULT_TOOL_PROVIDERS} onChangeProvider={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '本地 OCR' })).not.toBeInTheDocument();

    const deepLRow = screen.getByRole('button', { name: 'DeepL API Free' });
    expect(within(deepLRow).queryByText('翻译 · 未启用')).not.toBeInTheDocument();
    expect(deepLRow.querySelector('.providerRowIcon svg')).not.toBeNull();
  });

  it('renders provider list and detail in separate columns', () => {
    render(<ProviderPanel providers={DEFAULT_TOOL_PROVIDERS} onChangeProvider={vi.fn()} />);

    expect(document.querySelector('.providerListPanel')).not.toBeNull();
    expect(document.querySelector('.providerEditorPanel')).not.toBeNull();
  });
});
