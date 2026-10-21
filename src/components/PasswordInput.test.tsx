// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from './PasswordInput';

afterEach(cleanup);

describe('PasswordInput', () => {
  it('menyembunyikan isi secara default', () => {
    const { container } = render(
      <PasswordInput id="pw" value="rahasia123" onChange={() => undefined} />,
    );

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('rahasia123');
  });

  it('menampilkan isi saat ikon mata diklik, lalu menyembunyikan lagi', () => {
    const { container } = render(
      <PasswordInput id="pw" value="rahasia123" onChange={() => undefined} />,
    );
    const input = container.querySelector('input') as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan password' }));
    expect(input.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Sembunyikan password' }));
    expect(input.type).toBe('password');
  });

  it('meneruskan ketikan ke onChange', () => {
    const onChange = vi.fn();
    const { container } = render(<PasswordInput id="pw" value="" onChange={onChange} />);

    fireEvent.change(container.querySelector('input') as HTMLInputElement, {
      target: { value: 'abc12345' },
    });

    expect(onChange).toHaveBeenCalledWith('abc12345');
  });
});
