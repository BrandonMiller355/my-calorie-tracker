import { buildChainNote } from './bulkPhotoChain';

describe('buildChainNote', () => {
  it('returns no note for the first photo (empty history)', () => {
    expect(buildChainNote([])).toBeUndefined();
  });

  it('names a single prior food with its weight and states the tare rule', () => {
    const note = buildChainNote([{ kind: 'identified', name: 'Black beans', grams: 142 }]);

    expect(note).toContain('already contained: Black beans (142 g)');
    expect(note).toContain('identify ONLY the new addition');
    expect(note).toContain('tared before each addition');
  });

  it('omits the weight when a prior food has none', () => {
    const note = buildChainNote([{ kind: 'identified', name: 'Black beans' }]);

    expect(note).toContain('already contained: Black beans.');
    expect(note).not.toContain('(');
  });

  it('lists a mixed history in order, including an unidentified addition', () => {
    const note = buildChainNote([
      { kind: 'identified', name: 'Black beans', grams: 142 },
      { kind: 'unidentified' },
      { kind: 'identified', name: 'Cheese sauce', grams: 89 },
    ]);

    expect(note).toContain(
      'already contained: Black beans (142 g), an unidentified addition, Cheese sauce (89 g).',
    );
  });
});
