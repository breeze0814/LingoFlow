import { render, screen, within } from '@testing-library/react';
import { ProviderPanel } from '../../features/settings/ProviderPanel';
import { DEFAULT_TOOL_PROVIDERS } from '../../features/settings/settingsTypes';

describe('ProviderPanel', () => {
  it('renders translate and ocr provider rows with glyph icons', () => {
    render(<ProviderPanel providers={DEFAULT_TOOL_PROVIDERS} onChangeProvider={vi.fn()} />);

    expect(screen.getByRole('button', { name: '本地 OCR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OpenAI OCR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OpenAI 翻译' })).toBeInTheDocument();

    const deepLRow = screen.getByRole('button', { name: 'DeepL' });
    expect(within(deepLRow).queryByText('翻译 · 未启用')).not.toBeInTheDocument();
    expect(deepLRow.querySelector('.providerRowIcon svg')).not.toBeNull();
  });

  it('renders provider list and detail in separate columns', () => {
    render(<ProviderPanel providers={DEFAULT_TOOL_PROVIDERS} onChangeProvider={vi.fn()} />);

    expect(document.querySelector('.providerListPanel')).not.toBeNull();
    expect(document.querySelector('.providerEditorPanel')).not.toBeNull();
  });
});
