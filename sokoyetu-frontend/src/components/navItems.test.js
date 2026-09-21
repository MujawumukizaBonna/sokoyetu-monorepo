import {
  matchesPath,
  RETAILER_NAV,
  MANUFACTURER_NAV,
  RETAILER_BOTTOM_NAV,
  MANUFACTURER_BOTTOM_NAV,
} from './navItems';

describe('matchesPath', () => {
  it('matches an exact path', () => {
    expect(matchesPath('/account', '/account')).toBe(true);
  });

  it('matches a sub-path of the target', () => {
    expect(matchesPath('/account/settings', '/account')).toBe(true);
    expect(matchesPath('/orders/42', '/orders')).toBe(true);
  });

  it('does not match a path that merely starts with the same letters', () => {
    // '/accounts' is a different route from '/account'; a naive startsWith()
    // would wrongly light up the Account nav item here.
    expect(matchesPath('/accounts', '/account')).toBe(false);
    expect(matchesPath('/orders-pending', '/orders')).toBe(false);
  });

  it('does not match an unrelated path', () => {
    expect(matchesPath('/orders', '/account')).toBe(false);
  });

  it('matches when any pattern in an array matches', () => {
    const match = ['/retailer', '/supplier', '/order'];
    expect(matchesPath('/retailer', match)).toBe(true);
    expect(matchesPath('/supplier/abc', match)).toBe(true);
    expect(matchesPath('/order/12', match)).toBe(true);
    expect(matchesPath('/account', match)).toBe(false);
  });

  it('delegates to a predicate function', () => {
    const onlyDashboard = (p) => p === '/manufacturer';
    expect(matchesPath('/manufacturer', onlyDashboard)).toBe(true);
    expect(matchesPath('/manufacturer/products', onlyDashboard)).toBe(false);
  });
});

describe('manufacturer nav', () => {
  it('highlights only the dashboard on /manufacturer', () => {
    // Regression guard: the dashboard entry used to be a plain '/manufacturer'
    // string, which also matched '/manufacturer/products' and lit up two items
    // at once. It is now an explicit predicate.
    const active = MANUFACTURER_NAV.filter((item) => matchesPath('/manufacturer', item.match));
    expect(active).toHaveLength(1);
    expect(active[0].label).toBe('Dashboard');
  });

  it('highlights only My products on /manufacturer/products', () => {
    const active = MANUFACTURER_NAV.filter((item) =>
      matchesPath('/manufacturer/products', item.match)
    );
    expect(active).toHaveLength(1);
    expect(active[0].label).toBe('My products');
  });

  it('highlights only Add product on /manufacturer/add-product', () => {
    const active = MANUFACTURER_NAV.filter((item) =>
      matchesPath('/manufacturer/add-product', item.match)
    );
    expect(active).toHaveLength(1);
    expect(active[0].label).toBe('Add product');
  });
});

describe('retailer nav', () => {
  it('keeps "Browse suppliers" active across the browse flow', () => {
    const browse = RETAILER_NAV[0];
    for (const path of ['/retailer', '/supplier/1', '/order/9']) {
      expect(matchesPath(path, browse.match)).toBe(true);
    }
  });

  it('does not leave Browse suppliers active on the orders screen', () => {
    expect(matchesPath('/orders', RETAILER_NAV[0].match)).toBe(false);
  });
});

describe('nav configuration', () => {
  const allNavs = [
    ['RETAILER_NAV', RETAILER_NAV],
    ['MANUFACTURER_NAV', MANUFACTURER_NAV],
    ['RETAILER_BOTTOM_NAV', RETAILER_BOTTOM_NAV],
    ['MANUFACTURER_BOTTOM_NAV', MANUFACTURER_BOTTOM_NAV],
  ];

  it.each(allNavs)('%s: every entry has an icon, a label, an absolute path and a matcher', (_, nav) => {
    expect(nav.length).toBeGreaterThan(0);
    for (const item of nav) {
      expect(item.icon).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.path.startsWith('/')).toBe(true);
      expect(item.match).toBeDefined();
    }
  });

  it.each(allNavs)('%s: every entry highlights on its own path', (_, nav) => {
    for (const item of nav) {
      expect(matchesPath(item.path, item.match)).toBe(true);
    }
  });

  it('gives both roles a way to reach the Account screen', () => {
    for (const nav of [RETAILER_NAV, MANUFACTURER_NAV]) {
      const account = nav.find((item) => item.path === '/account');
      expect(account).toBeDefined();
      expect(matchesPath('/account', account.match)).toBe(true);
    }
  });

  it('points the bottom bars at routes that exist in the sidebar navs', () => {
    for (const [top, bottom] of [
      [RETAILER_NAV, RETAILER_BOTTOM_NAV],
      [MANUFACTURER_NAV, MANUFACTURER_BOTTOM_NAV],
    ]) {
      const topPaths = top.map((item) => item.path);
      for (const item of bottom) {
        expect(topPaths).toContain(item.path);
      }
    }
  });
});
