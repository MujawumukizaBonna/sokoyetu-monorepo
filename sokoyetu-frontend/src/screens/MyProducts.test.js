import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import MyProducts from './MyProducts';
import { getMyProducts, updateProduct, deleteProduct } from '../api';

jest.mock('../api', () => ({
  getMyProducts: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
}));

const mockLogoutUser = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ logoutUser: mockLogoutUser }),
}));

const LIVE = {
  id: 'prod-1',
  name: 'Fresh Milk',
  emoji: '🥛',
  price_rwf: 450,
  unit: '500ml',
  moq: 24,
  stock: 500,
  category: 'Food & beverage',
  description: 'Chilled',
  available: true,
};

const HIDDEN = {
  id: 'prod-2',
  name: 'Laundry Soap',
  emoji: '🧼',
  price_rwf: 300,
  unit: 'bar',
  moq: 12,
  stock: 0,
  category: 'Cleaning',
  description: '',
  available: false,
};

const renderMyProducts = () =>
  render(
    <MemoryRouter initialEntries={['/manufacturer/products']}>
      <Routes>
        <Route path="/manufacturer/products" element={<MyProducts />} />
        <Route path="/manufacturer/add-product" element={<div>add product screen</div>} />
        <Route path="/manufacturer" element={<div>manufacturer home</div>} />
      </Routes>
    </MemoryRouter>
  );

const openEditor = (index = 0) =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[index]);

const saveButton = () => screen.getByRole('button', { name: /Save changes/i });
const setField = (input, value) => fireEvent.change(input, { target: { value } });

// "Live" and "Hidden" are both a stat label and a per-product badge, so a bare
// getByText would match several nodes. Scope to the card that holds the name.
const badgeFor = (productName, badge) =>
  within(screen.getByText(productName).closest('.card')).getByText(badge);

// Same problem for the counts: read the number out of the matching stat card.
const stat = (label) => {
  const grid = document.querySelector('.stats-grid');
  const card = within(grid).getByText(label).parentElement;
  return within(card).getByText(/^\d+$/).textContent;
};

beforeEach(() => {
  jest.clearAllMocks();

  getMyProducts.mockResolvedValue({ data: [LIVE, HIDDEN] });
  updateProduct.mockResolvedValue({ data: LIVE });
  deleteProduct.mockResolvedValue({ data: {} });
});

describe('loading the listings', () => {
  it('shows each product with its price, stock and minimum order', async () => {
    renderMyProducts();

    expect(await screen.findByText('Fresh Milk')).toBeInTheDocument();
    expect(screen.getByText('Laundry Soap')).toBeInTheDocument();
    expect(screen.getByText('RWF 450')).toBeInTheDocument();
    expect(screen.getByText('Stock 500')).toBeInTheDocument();
    expect(screen.getByText('Min. order 24 units')).toBeInTheDocument();
  });

  it('splits the listings into live and hidden', async () => {
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    expect(stat('Total listings')).toBe('2');
    expect(stat('Live')).toBe('1');
    expect(stat('Hidden')).toBe('1');
  });

  it('invites the manufacturer to publish when there are no listings', async () => {
    getMyProducts.mockResolvedValue({ data: [] });
    renderMyProducts();

    expect(await screen.findByText('No products yet')).toBeInTheDocument();
    expect(screen.getByText(/Publish your first listing/)).toBeInTheDocument();
  });

  it('reports a failed load', async () => {
    getMyProducts.mockRejectedValue({ response: { data: { error: 'Session expired' } } });
    renderMyProducts();

    expect(await screen.findByText('Session expired')).toBeInTheDocument();
  });
});

describe('availability', () => {
  it('hides a live product rather than destroying it', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    fireEvent.click(screen.getByRole('button', { name: 'Hide from retailers' }));

    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith('prod-1'));
    // The copy has to make clear the listing is recoverable, not gone.
    expect(await screen.findByText(/is hidden from retailers/)).toBeInTheDocument();
    expect(badgeFor('Fresh Milk', 'Hidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeInTheDocument();
  });

  it('makes a hidden product live again', async () => {
    getMyProducts.mockResolvedValue({ data: [HIDDEN] });
    updateProduct.mockResolvedValue({ data: { ...HIDDEN, available: true } });
    renderMyProducts();
    await screen.findByText('Laundry Soap');

    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));

    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith('prod-2', { available: true })
    );
    expect(await screen.findByText(/is live again/)).toBeInTheDocument();
    expect(badgeFor('Laundry Soap', 'Live')).toBeInTheDocument();
  });

  it('leaves the product untouched when hiding fails', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    deleteProduct.mockRejectedValue({ response: { data: { error: 'Product has open orders' } } });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    fireEvent.click(screen.getByRole('button', { name: 'Hide from retailers' }));

    expect(await screen.findByText('Product has open orders')).toBeInTheDocument();
    // The badge must not flip optimistically when the request failed.
    expect(badgeFor('Fresh Milk', 'Live')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide from retailers' })).toBeInTheDocument();
  });

  it('shows the button as busy while the change is in flight', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    let release;
    deleteProduct.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    fireEvent.click(screen.getByRole('button', { name: 'Hide from retailers' }));

    expect(await screen.findByRole('button', { name: 'Working...' })).toBeDisabled();

    release({ data: {} });
    expect(await screen.findByText(/is hidden from retailers/)).toBeInTheDocument();
  });
});

describe('editing a listing', () => {
  it('prefills the editor from the product', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    openEditor();

    expect(screen.getByDisplayValue('Fresh Milk')).toBeInTheDocument();
    expect(screen.getByDisplayValue('450')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500ml')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
  });

  it('closes the editor without saving when cancelled', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateProduct).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('sends the trimmed name and the parsed numbers', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    openEditor();
    setField(screen.getByDisplayValue('Fresh Milk'), '  Fresh Milk  ');
    setField(screen.getByDisplayValue('450'), '525');
    setField(screen.getByDisplayValue('24'), '30');
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(updateProduct).toHaveBeenCalledWith('prod-1', {
        name: 'Fresh Milk',
        emoji: '🥛',
        price_rwf: 525,
        unit: '500ml',
        moq: 30,
        stock: 500,
        category: 'Food & beverage',
        description: 'Chilled',
      })
    );
  });

  it('replaces the row with the saved product', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    updateProduct.mockResolvedValue({
      data: { ...LIVE, name: 'Fresh Milk 1L', price_rwf: 900 },
    });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    openEditor();
    setField(screen.getByDisplayValue('Fresh Milk'), 'Fresh Milk 1L');
    setField(screen.getByDisplayValue('450'), '900');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Product updated.')).toBeInTheDocument();
    expect(screen.getByText('Fresh Milk 1L')).toBeInTheDocument();
    expect(screen.getByText('RWF 900')).toBeInTheDocument();
    // The editor closes, so the Edit button is back.
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('keeps the editor open when the save fails', async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    updateProduct.mockRejectedValue({ response: { data: { error: 'Price is too high' } } });
    renderMyProducts();
    await screen.findByText('Fresh Milk');

    openEditor();
    fireEvent.click(saveButton());

    expect(await screen.findByText('Price is too high')).toBeInTheDocument();
    // Keeping the form open is the point: the typed changes are not lost.
    expect(saveButton()).toBeInTheDocument();
  });
});

describe('edit validation', () => {
  const startEditing = async () => {
    getMyProducts.mockResolvedValue({ data: [LIVE] });
    renderMyProducts();
    await screen.findByText('Fresh Milk');
    openEditor();
  };

  it('refuses a blank name', async () => {
    await startEditing();
    setField(screen.getByDisplayValue('Fresh Milk'), '   ');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Product name is required.')).toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('refuses an empty price', async () => {
    await startEditing();
    setField(screen.getByDisplayValue('450'), '');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Unit price must be a positive number.')).toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('refuses a price of zero', async () => {
    await startEditing();
    setField(screen.getByDisplayValue('450'), '0');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Unit price must be a positive number.')).toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('refuses a minimum order of zero', async () => {
    await startEditing();
    setField(screen.getByDisplayValue('24'), '0');
    fireEvent.click(saveButton());

    expect(
      await screen.findByText('Minimum order quantity must be a positive number.')
    ).toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('refuses negative stock', async () => {
    await startEditing();
    setField(screen.getByDisplayValue('500'), '-1');
    fireEvent.click(saveButton());

    expect(await screen.findByText('Stock cannot be negative.')).toBeInTheDocument();
    expect(updateProduct).not.toHaveBeenCalled();
  });
});

describe('navigation', () => {
  it('opens the add-product screen', async () => {
    getMyProducts.mockResolvedValue({ data: [] });
    renderMyProducts();
    await screen.findByText('No products yet');

    fireEvent.click(screen.getByRole('button', { name: '+ Add new product listing' }));

    expect(await screen.findByText('add product screen')).toBeInTheDocument();
  });
});
