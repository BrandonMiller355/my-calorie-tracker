import { fireEvent, render, screen } from '@testing-library/react';
import { FoodNameCombobox } from './FoodNameCombobox';
import type { LibraryFood } from '../types';

const yogurt: LibraryFood = {
  id: 'f1',
  name: 'Greek yogurt',
  description: 'Fage 2%',
  calories: 120,
  carbs: 8,
  protein: 15,
  fat: 4,
  source: 'manual',
};

const banana: LibraryFood = {
  id: 'f2',
  name: 'Banana',
  calories: 105,
  carbs: 27,
  protein: 1,
  fat: 0,
  source: 'manual',
};

function setup() {
  const onChange = vi.fn();
  const onSelectFood = vi.fn();
  const onAction = vi.fn();
  render(
    <FoodNameCombobox
      value=""
      onChange={onChange}
      groups={[{ label: 'Recent · Breakfast', foods: [yogurt, banana] }]}
      actions={[{ id: 'search', label: 'Search online', onSelect: onAction }]}
      onSelectFood={onSelectFood}
    />,
  );
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  return { onChange, onSelectFood, onAction, input };
}

describe('FoodNameCombobox', () => {
  it('opens on focus, showing grouped foods (description as secondary line) and actions', () => {
    setup();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Recent · Breakfast')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /Greek yogurt/ })).toHaveTextContent('Fage 2%');
  });

  it('arrow keys move the highlight and Enter selects the highlighted food', () => {
    const { onSelectFood, input } = setup();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Greek yogurt/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectFood).toHaveBeenCalledWith(banana);
  });

  it('ArrowUp wraps to the last option (the action row) and Enter runs it', () => {
    const { onSelectFood, onAction, input } = setup();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAction).toHaveBeenCalled();
    expect(onSelectFood).not.toHaveBeenCalled();
  });

  it('Enter with nothing highlighted falls through to the form (free text path)', () => {
    const { onSelectFood, onAction, input } = setup();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectFood).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('Escape closes the list', () => {
    const { input } = setup();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clicking an option selects it', () => {
    const { onSelectFood } = setup();
    fireEvent.click(screen.getByRole('option', { name: /Banana/ }));
    expect(onSelectFood).toHaveBeenCalledWith(banana);
  });
});
