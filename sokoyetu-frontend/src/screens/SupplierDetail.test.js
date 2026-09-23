import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';

import SupplierDetail from './SupplierDetail';
import { getSupplierById, getProducts } from '../api';

jest.mock('../api', () => ({
  getSupplierById: jest.fn(),
  getProducts: jest.fn(),
}));

const ShowOrder = () => {
  const { productId } = useParams();
  return <div>{`order ${productId}`}</div>;
};

const renderSupplierDetail = () =>
  render(
    <MemoryRouter initialEntries={['/supplier/s1']}>
      <Routes>
        <Route path="/supplier/:id" element={<SupplierDetail />} />
        <Route path="/order/:productId" element={<ShowOrder />} />
        <Route path="/retailer" element={<div>retailer home</div>} />
      </Routes>
    </MemoryRouter>
  );

const SUPPLIER = {
  id: 's1',
  name: 'Kigali Dairy Works',
  category: 'Food & beverage',
  location: 'Kigali',
  emoji: '🥛',
  verified: true,
  rating: 4.5,
  reviews_count: 12,
  established: 2018,
  description: 'Family-run dairy since 2018.',
};

const PRODUCTS = [
  { id: 'p1', name: 'Fresh Milk', price_rwf: 1200, unit: '500ml', moq: 5, emoji: '🥛' },
  { id: 'p2', name: 'Yoghurt', price_rwf: 900, unit: '250ml', moq: 12, emoji: '🍚' },
];

// The name is rendered twice: as the nav title and as the heading, so the
// heading role is what distinguishes the two.
beforeEach(() => {
  jest.clearAllMocks();
  getSupplierById.mockResolvedValue({ data: SUPPLIER });
  getProducts.mockResolvedValue({ data: PRODUCTS });
});

describe('the supplier', () => {
  it('shows its name, category, location and established year', async () => {
    renderSupplierDetail();

    expect(await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' })).toBeInTheDocument();
    expect(screen.getByText(/Food & beverage · Kigali/)).toBeInTheDocument();
    expect(screen.getByText(/Est\. 2018/)).toBeInTheDocument();
  });

  it('leaves the established year out when it is unknown', async () => {
    getSupplierById.mockResolvedValue({ data: { ...SUPPLIER, established: undefined } });
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.queryByText(/Est\./)).not.toBeInTheDocument();
  });

  it('shows the verified badge and the rating with its review count', async () => {
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.getByText('Verified supplier')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5 (12 reviews)')).toBeInTheDocument();
  });

  it('marks an unverified supplier as new and hides a zero rating', async () => {
    getSupplierById.mockResolvedValue({
      data: { ...SUPPLIER, verified: false, rating: 0 },
    });
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.getByText('New supplier')).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it('shows the description only when there is one', async () => {
    getSupplierById.mockResolvedValue({ data: { ...SUPPLIER, description: '' } });
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.queryByText('Family-run dairy since 2018.')).not.toBeInTheDocument();
  });

  it('reports a supplier that cannot be loaded', async () => {
    getSupplierById.mockResolvedValue({ data: null });
    getProducts.mockResolvedValue({ data: [] });
    renderSupplierDetail();

    expect(await screen.findByText('Supplier not found.')).toBeInTheDocument();
  });
});

describe('the product listings', () => {
  it('counts them and shows each one with its price and minimum order', async () => {
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.getByText('Available products (2)')).toBeInTheDocument();
    expect(screen.getByText('Fresh Milk')).toBeInTheDocument();
    expect(screen.getByText('RWF 1,200 / 500ml')).toBeInTheDocument();
    expect(screen.getByText('Min. 5 units')).toBeInTheDocument();
  });

  it('falls back to a generic unit when the product has none', async () => {
    getProducts.mockResolvedValue({
      data: [{ id: 'p1', name: 'Fresh Milk', price_rwf: 1200, unit: '', moq: 5 }],
    });
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.getByText('RWF 1,200 / unit')).toBeInTheDocument();
  });

  it('shows an empty state when the supplier lists nothing', async () => {
    getProducts.mockResolvedValue({ data: [] });
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    expect(screen.getByText('Available products (0)')).toBeInTheDocument();
    expect(screen.getByText('No products listed yet')).toBeInTheDocument();
  });

  it('opens the order screen for a product', async () => {
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    fireEvent.click(screen.getByRole('button', { name: /Fresh Milk/ }));

    expect(await screen.findByText('order p1')).toBeInTheDocument();
  });

  it('returns to the supplier list', async () => {
    renderSupplierDetail();
    await screen.findByRole('heading', { level: 2, name: 'Kigali Dairy Works' });

    fireEvent.click(screen.getByRole('button', { name: '‹ Suppliers' }));

    expect(await screen.findByText('retailer home')).toBeInTheDocument();
  });
});
