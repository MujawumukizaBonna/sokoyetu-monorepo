import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';

import RetailerHome from './RetailerHome';
import { getSuppliers } from '../api';

jest.mock('../api', () => ({
  getSuppliers: jest.fn(),
}));

const mockLogoutUser = jest.fn();
let mockUser;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logoutUser: mockLogoutUser }),
}));

const ShowSupplier = () => {
  const { id } = useParams();
  return <div>{`supplier ${id}`}</div>;
};

const renderRetailerHome = () =>
  render(
    <MemoryRouter initialEntries={['/retailer']}>
      <Routes>
        <Route path="/retailer" element={<RetailerHome />} />
        <Route path="/supplier/:id" element={<ShowSupplier />} />
        <Route path="/orders" element={<div>my orders</div>} />
      </Routes>
    </MemoryRouter>
  );

const VERIFIED = {
  id: 's1',
  name: 'Kigali Dairy Works',
  category: 'Food & beverage',
  location: 'Kigali',
  emoji: '🥛',
  verified: true,
  rating: 4.5,
};

const UNVERIFIED = {
  id: 's2',
  name: 'Nyagatare Textiles',
  category: 'Textiles',
  location: 'Nyagatare',
  emoji: '🧵',
  verified: false,
  rating: 0,
};

// The supplier cards are buttons whose names contain the category, so scope to
// the filter row rather than matching "Textiles" against the whole document.
const filterPill = (label) =>
  within(document.querySelector('.filter-row')).getByRole('button', { name: label });

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 1, name: 'Amina Uwase', role: 'retailer' };
  getSuppliers.mockResolvedValue({ data: [VERIFIED, UNVERIFIED] });
});

describe('the supplier list', () => {
  it('greets the retailer by first name', async () => {
    renderRetailerHome();

    expect(await screen.findByText(/Hi, Amina\./)).toBeInTheDocument();
  });

  it('shows each supplier with its location and badges', async () => {
    renderRetailerHome();

    expect(await screen.findByText('Kigali Dairy Works')).toBeInTheDocument();
    expect(screen.getByText('Food & beverage · Kigali')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5')).toBeInTheDocument();
  });

  it('hides the rating badge for a supplier with no reviews', async () => {
    getSuppliers.mockResolvedValue({ data: [UNVERIFIED] });
    renderRetailerHome();
    await screen.findByText('Nyagatare Textiles');

    // rating 0 means "no reviews yet", not "rated zero".
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it('counts the suppliers', async () => {
    renderRetailerHome();

    expect(await screen.findByText('2 suppliers found')).toBeInTheDocument();
  });

  it('uses the singular for one supplier', async () => {
    getSuppliers.mockResolvedValue({ data: [VERIFIED] });
    renderRetailerHome();

    expect(await screen.findByText('1 supplier found')).toBeInTheDocument();
  });

  it('invites a different search when nothing matches', async () => {
    getSuppliers.mockResolvedValue({ data: [] });
    renderRetailerHome();

    expect(await screen.findByText('No suppliers found')).toBeInTheDocument();
    expect(screen.getByText(/Try a different search or category/)).toBeInTheDocument();
  });

  it('opens a supplier', async () => {
    renderRetailerHome();
    await screen.findByText('Kigali Dairy Works');

    fireEvent.click(screen.getByRole('button', { name: /Kigali Dairy Works/ }));

    expect(await screen.findByText('supplier s1')).toBeInTheDocument();
  });
});

describe('searching and filtering', () => {
  it('asks for no filter at all on first load', async () => {
    renderRetailerHome();
    await screen.findByText('Kigali Dairy Works');

    // "All" is the absence of a category, not a category named All.
    expect(getSuppliers).toHaveBeenCalledWith({});
  });

  it('sends the chosen category', async () => {
    renderRetailerHome();
    await screen.findByText('Kigali Dairy Works');

    fireEvent.click(filterPill('Textiles'));

    await waitFor(() => expect(getSuppliers).toHaveBeenLastCalledWith({ category: 'Textiles' }));
  });

  it('sends the search term', async () => {
    renderRetailerHome();
    await screen.findByText('Kigali Dairy Works');

    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), {
      target: { value: 'milk' },
    });

    await waitFor(() => expect(getSuppliers).toHaveBeenLastCalledWith({ search: 'milk' }));
  });

  it('sends both together', async () => {
    renderRetailerHome();
    await screen.findByText('Kigali Dairy Works');

    fireEvent.click(filterPill('Cleaning'));
    fireEvent.change(screen.getByPlaceholderText('Search suppliers...'), {
      target: { value: 'soap' },
    });

    await waitFor(() =>
      expect(getSuppliers).toHaveBeenLastCalledWith({ category: 'Cleaning', search: 'soap' })
    );
  });

  it('drops the category again when All is reselected', async () => {
    renderRetailerHome();
    await screen.findByText('Kigali Dairy Works');

    fireEvent.click(filterPill('Textiles'));
    await waitFor(() => expect(getSuppliers).toHaveBeenLastCalledWith({ category: 'Textiles' }));

    fireEvent.click(filterPill('All'));

    await waitFor(() => expect(getSuppliers).toHaveBeenLastCalledWith({}));
  });
});
