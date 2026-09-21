// Shared navigation definitions for the sidebar and mobile bottom bar.
// Keeping these in one place means the "Account" target and the active-item
// logic stay consistent across every screen.

export function matchesPath(pathname, match) {
  if (Array.isArray(match)) {
    return match.some(pattern => matchesPath(pathname, pattern));
  }

  if (typeof match === 'function') {
    return match(pathname);
  }

  return pathname === match || pathname.startsWith(`${match}/`);
}

export const RETAILER_NAV = [
  { icon: '🏪', label: 'Browse suppliers', meta: 'Explore manufacturers', path: '/retailer', match: ['/retailer', '/supplier', '/order'] },
  { icon: '📦', label: 'My orders', meta: 'Track recent orders', path: '/orders', match: '/orders' },
  { icon: '👤', label: 'Account', meta: 'Profile and settings', path: '/account', match: '/account' },
];

export const MANUFACTURER_NAV = [
  // Explicit predicate: a plain '/manufacturer' string would also match
  // '/manufacturer/products' and light up two items at once.
  { icon: '📊', label: 'Dashboard', meta: 'Performance overview', path: '/manufacturer', match: (p) => p === '/manufacturer' },
  { icon: '📦', label: 'My products', meta: 'Edit listings and stock', path: '/manufacturer/products', match: '/manufacturer/products' },
  { icon: '➕', label: 'Add product', meta: 'Create listings', path: '/manufacturer/add-product', match: '/manufacturer/add-product' },
  { icon: '👤', label: 'Account', meta: 'Profile and settings', path: '/account', match: '/account' },
];

export const RETAILER_BOTTOM_NAV = [
  { icon: '🏪', label: 'Browse', path: '/retailer', match: ['/retailer', '/supplier', '/order'] },
  { icon: '📦', label: 'Orders', path: '/orders', match: '/orders' },
  { icon: '👤', label: 'Account', path: '/account', match: '/account' },
];

export const MANUFACTURER_BOTTOM_NAV = [
  { icon: '📊', label: 'Dashboard', path: '/manufacturer', match: (p) => p === '/manufacturer' },
  { icon: '📦', label: 'Products', path: '/manufacturer/products', match: '/manufacturer/products' },
  { icon: '➕', label: 'Add', path: '/manufacturer/add-product', match: '/manufacturer/add-product' },
  { icon: '👤', label: 'Account', path: '/account', match: '/account' },
];
