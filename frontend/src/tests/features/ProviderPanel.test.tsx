import { render, screen, within } from '@testing-library/react';
import { ProviderPanel } from '../../features/settings/ProviderPanel';
import { DEFAULT_TOOL_PROVIDERS } from '../../features/settings/settingsTypes';

describe('ProviderPanel', () => {
  it('renders provider rows with glyph icons and secondary status text', () => {
    render(<ProviderPanel providers={DEFAULT_TOOL_PROVIDERS} onChangeProvider={vi.fn()} />);

    const localOcrRow = screen.getByRole('button', { name: '本地 OCR' });
    expect(within(localOcrRow).getByText('OCR · 已启用')).toBeInTheDocument();
    expect(localOcrRow.querySelector('.providerRowIcon svg')).not.toBeNull();

    const deepLRow = screen.getByRole('button', { name: 'DeepL API Free' });
    expect(within(deepLRow).getByText('翻译 · 未启用')).toBeInTheDocument();
    expect(deepLRow.querySelector('.providerRowIcon svg')).not.toBeNull();
  });
});
