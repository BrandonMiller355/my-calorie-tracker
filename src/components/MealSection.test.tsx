import { render, screen } from '@testing-library/react';
import { MealSection } from './MealSection';
import type { FoodEntry } from '../types';

const QUICK_ENTRY: FoodEntry = {
  id: 'entry-quick-1',
  date: '2026-07-09',
  meal: 'dinner',
  name: 'Calories',
  amount: 1,
  unit: 'serving',
  servingLabel: 'serving',
  quantity: 1,
  calories: 450,
  carbs: 40,
  protein: 30,
  fat: 10,
  source: 'quick',
  description: 'wedding buffet',
};

const NORMAL_ENTRY: FoodEntry = {
  id: 'entry-1',
  date: '2026-07-09',
  meal: 'dinner',
  name: 'Chicken breast',
  amount: 150,
  unit: 'g',
  servingLabel: 'serving',
  servingSize: { amount: 100, unit: 'g' },
  quantity: 1.5,
  calories: 165,
  carbs: 0,
  protein: 31,
  fat: 4,
  source: 'manual',
};

function renderSection(entries: FoodEntry[]) {
  render(
    <MealSection
      meal="dinner"
      entries={entries}
      onAdd={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
    />,
  );
}

describe('MealSection quick entry rows', () => {
  it('leads the caption with the description, followed by the macro breakdown', () => {
    renderSection([QUICK_ENTRY]);

    expect(screen.getByText('Calories')).toBeInTheDocument();
    expect(screen.getByText(/F 10 · C 40 · P 30/)).toHaveTextContent(
      'wedding buffet · F 10 · C 40 · P 30',
    );
    expect(screen.getByText('450')).toBeInTheDocument();
    // Quick entries never show a logged quantity
    expect(screen.queryByText(/1 serving/)).not.toBeInTheDocument();
  });

  it('shows just the macro breakdown when a quick entry has no description', () => {
    renderSection([{ ...QUICK_ENTRY, description: undefined, carbs: 0, protein: 0, fat: 0 }]);

    const caption = screen.getByText(/F 0 · C 0 · P 0/);
    expect(caption.textContent?.trim()).toBe('F 0 · C 0 · P 0');
  });

  it('keeps the quantity caption for normal entries', () => {
    renderSection([NORMAL_ENTRY]);

    expect(screen.getByText(/F 6 · C 0 · P 46.5/)).toHaveTextContent(
      '150 g · F 6 · C 0 · P 46.5',
    );
  });
});
