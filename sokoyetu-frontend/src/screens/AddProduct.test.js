import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import AddProduct from './AddProduct';
import { createProduct } from '../api';

jest.mock('../api', () => ({
  createProduct: jest.fn(),
}));

const NAME = 'Fresh Milk 500ml';

const renderAddProduct = () =>
  render(
    <MemoryRouter initialEntries={['/manufacturer/add-product']}>
      <Routes>
        <Route path="/manufacturer/add-product" element={<AddProduct />} />
        <Route path="/manufacturer" element={<div>manufacturer home</div>} />
      </Routes>
    </MemoryRouter>
  );

const next = () => fireEvent.click(screen.getByRole('button', { name: /Next/ }));
const publish = () => fireEvent.click(screen.getByRole('button', { name: /Publish listing/i }));
const nameField = () => screen.getByPlaceholderText('e.g. Fresh milk 500ml');

// The two steps that hold the required fields, ending on the preview.
const fillRequired = () => {
  fireEvent.change(nameField(), { target: { value: NAME } });
  next();
  fireEvent.change(screen.getByPlaceholderText('450'), { target: { value: '450' } });
  fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '24' } });
  next();
};

beforeEach(() => {
  jest.clearAllMocks();
  createProduct.mockResolvedValue({ data: {} });
});

describe('the three steps', () => {
  it('walks forward from details to preview', () => {
    renderAddProduct();

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Product details')).toBeInTheDocument();

    next();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Pricing and stock')).toBeInTheDocument();

    next();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByText('Preview and publish')).toBeInTheDocument();
  });

  it('steps back to the previous one', () => {
    renderAddProduct();
    next();
    next();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });
});

describe('publishing', () => {
  it('refuses to publish without the required fields', async () => {
    renderAddProduct();
    next();
    next();

    publish();

    expect(await screen.findByText('Product name, price, and MOQ are required.')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('sends numbers and defaults a blank stock to zero', async () => {
    renderAddProduct();
    fillRequired();

    publish();

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith({
        name: NAME,
        category: 'Food & beverage',
        description: '',
        emoji: '📦',
        price_rwf: 450,
        unit: '',
        moq: 24,
        stock: 0,
        available: true,
      })
    );
  });

  it('carries the stock when one is given', async () => {
    renderAddProduct();
    fireEvent.change(nameField(), { target: { value: NAME } });
    next();
    fireEvent.change(screen.getByPlaceholderText('450'), { target: { value: '450' } });
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '24' } });
    fireEvent.change(screen.getByPlaceholderText('500'), { target: { value: '750' } });
    next();

    publish();

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ price_rwf: 450, moq: 24, stock: 750 })
      )
    );
  });

  it('reports a failed publish and keeps the work on screen', async () => {
    createProduct.mockRejectedValue({ response: { data: { error: 'You already listed this product' } } });
    renderAddProduct();
    fillRequired();

    publish();

    expect(await screen.findByText('You already listed this product')).toBeInTheDocument();
    // Still on the preview step, with the button usable again.
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish listing/i })).toBeEnabled();
  });

  it('shows the publish button as busy while it is in flight', async () => {
    createProduct.mockReturnValue(new Promise(() => {}));
    renderAddProduct();
    fillRequired();

    publish();

    expect(await screen.findByRole('button', { name: 'Publishing...' })).toBeDisabled();
  });

  it('confirms the listing on success', async () => {
    renderAddProduct();
    fillRequired();

    publish();

    expect(await screen.findByText('Product listed!')).toBeInTheDocument();
    expect(screen.getByText(NAME)).toBeInTheDocument();
  });

  it('resets the wizard for another product', async () => {
    renderAddProduct();
    fillRequired();
    publish();
    await screen.findByText('Product listed!');

    fireEvent.click(screen.getByRole('button', { name: 'Add another product' }));

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(nameField()).toHaveValue('');
  });

  it('returns to the dashboard', async () => {
    renderAddProduct();
    fillRequired();
    publish();
    await screen.findByText('Product listed!');

    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));

    expect(await screen.findByText('manufacturer home')).toBeInTheDocument();
  });
});

describe('the pricing step', () => {
  it('shows the minimum order value', () => {
    renderAddProduct();
    next();

    fireEvent.change(screen.getByPlaceholderText('450'), { target: { value: '450' } });
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '24' } });

    // 450 x 24.
    expect(screen.getByText('RWF 10,800')).toBeInTheDocument();
  });
});

describe('the preview', () => {
  it('shows the icon that was chosen', () => {
    renderAddProduct();

    fireEvent.click(screen.getByRole('button', { name: '🌾' }));
    next();
    next();

    expect(screen.getByText('🌾')).toBeInTheDocument();
  });
});
