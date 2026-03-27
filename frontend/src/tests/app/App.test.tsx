import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../app/App';

describe('App', () => {
  it('renders settings tabs', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: '工具' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '通用' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '服务' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '高级' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '隐私' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '关于' })).not.toBeInTheDocument();
  });

  it('keeps shortcut-only behavior on main page', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: '输入翻译' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '截图翻译' })).not.toBeInTheDocument();
    expect(screen.queryByText('Settings Hub')).not.toBeInTheDocument();
    expect(screen.queryByText('LingoFlow')).not.toBeInTheDocument();
  });

  it('triggers shortcut action after modifiers are released', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA', altKey: true });
    expect(screen.queryByRole('heading', { name: '输入翻译' })).not.toBeInTheDocument();

    fireEvent.keyUp(window, { key: 'a', code: 'KeyA', altKey: true });
    expect(screen.queryByRole('heading', { name: '输入翻译' })).not.toBeInTheDocument();

    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });
    expect(screen.getByRole('heading', { name: '输入翻译' })).toBeInTheDocument();
  });
});
