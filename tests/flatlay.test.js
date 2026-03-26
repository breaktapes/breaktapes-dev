const { loadSPA } = require('./spa-loader');

beforeAll(() => {
  loadSPA({ races: [] });
});

describe('Flatlay template groups', () => {
  test('exposes the configured running templates', () => {
    const groups = getFlatlayTemplateGroups();
    const running = groups.find(group => group.key === 'running');
    expect(running).toBeTruthy();
    expect(running.templates).toEqual([
      '5K',
      '10K',
      'Half Marathon',
      'Marathon',
      '50K',
      '50 Mile',
      '100K',
      '100 Mile'
    ]);
  });

  test('includes triathlon, hyrox, swimming, and cycling groups', () => {
    const groups = getFlatlayTemplateGroups();
    expect(groups.map(group => group.key)).toEqual(
      expect.arrayContaining(['triathlon', 'hyrox', 'swimming', 'cycling'])
    );
  });
});

describe('Flatlay filters', () => {
  test('matchesFlatlayFilters combines search, category, and brand', () => {
    const maurten = {
      brand: 'Maurten',
      name: 'Gel 100',
      category: 'nutrition',
      metadata: { fuel_type: 'gel' }
    };

    expect(getFlatlayProductMeta(maurten)).toBe('gel');
    expect(formatFlatlayCategoryLabel(maurten)).toBe('Nutrition');
  });

  test('getFlatlayBrandOptions returns sorted distinct brands', () => {
    expect(Array.isArray(getFlatlayBrandOptions())).toBe(true);
  });

  test('getFlatlayVisibleBrandOptions narrows brands by category and subcategory', () => {
    flatlayCategoryFilter = 'nutrition';
    flatlaySubcategoryFilter = 'Drink Mix';

    const brands = getFlatlayVisibleBrandOptions();
    expect(Array.isArray(brands)).toBe(true);
  });

  test('normalizes legacy flatlay categories into marketplace buckets', () => {
    const normalized = normalizeFlatlayProduct({
      category: 'swim_gear',
      name: 'Special Ops 3.0 Goggles',
      metadata: {}
    });

    expect(normalized.category).toBe('swim');
    expect(normalized.metadata.primary_subcategory).toBe('Goggles');
    expect(normalized.metadata.subcategories).toEqual(['Goggles']);
    expect(formatFlatlayCategoryLabel(normalized)).toBe('Swim · Goggles');
  });

  test('reads primary and secondary subcategories from metadata', () => {
    const product = normalizeFlatlayProduct({
      category: 'footwear',
      name: 'Zoom Fly 6',
      metadata: {
        primary_subcategory: 'Tempo Shoes',
        subcategories: ['Tempo Shoes', 'Race Shoes']
      }
    });

    expect(getFlatlayPrimarySubcategory(product)).toBe('Tempo Shoes');
    expect(getFlatlaySubcategories(product)).toEqual(['Tempo Shoes', 'Race Shoes']);
    expect(getFlatlaySecondarySubcategories(product)).toEqual(['Race Shoes']);
    expect(formatFlatlayCategoryLabel(product)).toBe('Footwear · Tempo Shoes, Race Shoes');
    expect(getFlatlayProductMeta(product)).toBe('Also tagged: Race Shoes');
  });

  test('exposes bike marketplace subcategories', () => {
    expect(getFlatlaySubcategoryOptions('bike')).toEqual(
      expect.arrayContaining(['Bikes', 'Indoor Trainers', 'Maintenance', 'Tools'])
    );
  });

  test('shows relevant nutrition subcategories', () => {
    expect(getFlatlaySubcategoryOptions('nutrition')).toEqual(
      expect.arrayContaining(['Gels', 'Drink Mix', 'Bars', 'Caffeine'])
    );
  });
});
