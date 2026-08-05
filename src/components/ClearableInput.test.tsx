import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ClearableInput, ClearableTextarea } from './ClearableInput';

function Field({ initial = '', disabled = false }: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <label>
      Food name
      <ClearableInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        clearLabel="Clear food name"
      />
    </label>
  );
}

describe('ClearableInput', () => {
  it('hides the clear button while the field is empty', () => {
    render(<Field />);
    expect(screen.queryByRole('button', { name: 'Clear food name' })).not.toBeInTheDocument();
  });

  it('clears the field through its own onChange and keeps focus', () => {
    render(<Field initial="oatmeal" />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear food name' }));

    const input = screen.getByLabelText('Food name');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear food name' })).not.toBeInTheDocument();
  });

  it('hides the clear button on a disabled field', () => {
    render(<Field initial="oatmeal" disabled />);
    expect(screen.queryByRole('button', { name: 'Clear food name' })).not.toBeInTheDocument();
  });

  it('leaves the field itself as the target of a label lookup', () => {
    render(<Field initial="oatmeal" />);
    expect(screen.getByLabelText(/Food name/)).toHaveValue('oatmeal');
  });

  it('clears a textarea the same way', () => {
    function Note() {
      const [value, setValue] = useState('two eggs');
      return (
        <label>
          Note
          <ClearableTextarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            clearLabel="Clear note"
          />
        </label>
      );
    }
    render(<Note />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear note' }));

    expect(screen.getByLabelText('Note')).toHaveValue('');
  });
});
