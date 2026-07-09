import { render, screen } from '@testing-library/react';
import { Summary } from './Summary';

const goals = { calories: 2000, carbs: 250, protein: 100, fat: 65 };

describe('Summary', () => {
  it('shows remaining amounts when under goal', () => {
    render(
      <Summary
        totals={{ calories: 1500, carbs: 100, protein: 80, fat: 40 }}
        goals={goals}
        goalsAreDefault={false}
      />,
    );
    expect(screen.getByText('500 kcal left')).toBeInTheDocument();
    expect(screen.getByText('150 g left')).toBeInTheDocument();
    expect(document.querySelector('.summary-card.over-bad')).toBeNull();
    expect(document.querySelector('.summary-card.over-good')).toBeNull();
  });

  it('shows a red over-goal indication when calorie burn is exceeded', () => {
    render(
      <Summary
        totals={{ calories: 2350, carbs: 100, protein: 80, fat: 40 }}
        goals={goals}
        goalsAreDefault={false}
      />,
    );
    expect(screen.getByText('Over by 350 kcal')).toBeInTheDocument();
    expect(document.querySelectorAll('.summary-card.over-bad')).toHaveLength(1);
    expect(document.querySelectorAll('.summary-card.over-good')).toHaveLength(0);
  });

  it('shows a green over-goal indication when a macro goal is exceeded', () => {
    render(
      <Summary
        totals={{ calories: 1500, carbs: 300, protein: 80, fat: 40 }}
        goals={goals}
        goalsAreDefault={false}
      />,
    );
    expect(screen.getByText('Over by 50 g')).toBeInTheDocument();
    expect(document.querySelectorAll('.summary-card.over-good')).toHaveLength(1);
    expect(document.querySelectorAll('.summary-card.over-bad')).toHaveLength(0);
  });

  it('notes when default goals are in use', () => {
    render(
      <Summary
        totals={{ calories: 0, carbs: 0, protein: 0, fat: 0 }}
        goals={goals}
        goalsAreDefault={true}
      />,
    );
    expect(screen.getByText(/default goals/i)).toBeInTheDocument();
  });
});
