import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import OrderSummary from './OrderSummary';
import {
  createOrder,
  createPawaPayDeposit,
  getPawaPayDepositStatus,
  getPawaPayProviders,
  getProductById,
  getSupplierById,
  predictPawaPayProvider,
} from '../api';

jest.mock('../api', () => ({
  createOrder: jest.fn(),
  createPawaPayDeposit: jest.fn(),
  getPawaPayDepositStatus: jest.fn(),
  getPawaPayProviders: jest.fn(),
  getProductById: jest.fn(),
  getSupplierById: jest.fn(),
  predictPawaPayProvider: jest.fn(),
}));

let mockUser;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Delivery fee is a flat 1500 in the component.
const DELIVERY = 1500;
const rwf = (n) => `RWF ${n.toLocaleString()}`;

const PRODUCT = {
  id: 'p1',
  name: 'Fresh Milk',
  price_rwf: 1200,
  moq: 5,
  emoji: '🥛',
  supplier_id: 's1',
};

const RETAILER = {
  name: 'Amina',
  role: 'retailer',
  phone: '0788123456',
  location: 'Rwanda',
};

const PROVIDERS = {
  data: {
    countries: [
      {
        prefix: '250',
        providers: [{ provider: 'MTN_MOMO_RWA', displayName: 'MTN Mobile Money' }],
      },
    ],
  },
};

const renderOrder = () =>
  render(
    <MemoryRouter initialEntries={['/order/p1']}>
      <Routes>
        <Route path="/order/:productId" element={<OrderSummary />} />
        <Route path="/orders" element={<div>my orders</div>} />
        <Route path="/retailer" element={<div>retailer home</div>} />
      </Routes>
    </MemoryRouter>
  );

const confirmButton = () => screen.getByRole('button', { name: /Confirm and pay via MoMo/i });
const waitForProduct = () => screen.findByText('Fresh Milk');

// A failed payment reports the reason twice: once in the actionable error box at
// the top of the form, and once in the note under the payment status card. Both
// are intended, so assert on the pair rather than on a single node.
const findFailureReason = async (reason) => {
  const matches = await screen.findAllByText(reason);
  expect(matches).toHaveLength(2);
  expect(matches.some((node) => node.classList.contains('error-box'))).toBe(true);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { ...RETAILER };

  getProductById.mockResolvedValue({ data: PRODUCT });
  getSupplierById.mockResolvedValue({ data: { id: 's1', name: 'Kigali Dairy Works' } });
  getPawaPayProviders.mockResolvedValue(PROVIDERS);
  predictPawaPayProvider.mockResolvedValue({ data: { provider: 'MTN_MOMO_RWA' } });
  createOrder.mockResolvedValue({ data: { order: { id: 'order-1' } } });
  createPawaPayDeposit.mockResolvedValue({
    data: { payment: { external_id: 'dep-1', status: 'processing' } },
  });
  getPawaPayDepositStatus.mockResolvedValue({ data: { payment: { status: 'processing' } } });
});

describe('loading the order', () => {
  it('shows the product, the supplier and the minimum order quantity', async () => {
    renderOrder();

    expect(await screen.findByText('Fresh Milk')).toBeInTheDocument();
    expect(screen.getByText('Kigali Dairy Works')).toBeInTheDocument();
    // Quantity starts at the MOQ rather than 1.
    expect(screen.getByText('Min. 5 units')).toBeInTheDocument();
  });

  it('reports a product that cannot be loaded', async () => {
    getProductById.mockResolvedValue({ data: null });
    renderOrder();

    expect(await screen.findByText(/Product not found/i)).toBeInTheDocument();
  });
});

describe('quantity', () => {
  it('steps up by the minimum order quantity', async () => {
    renderOrder();
    await waitForProduct();

    fireEvent.click(screen.getByRole('button', { name: '+' }));

    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('never drops below the minimum order quantity', async () => {
    renderOrder();
    await waitForProduct();

    fireEvent.click(screen.getByRole('button', { name: '-' }));

    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('the total', () => {
  it('adds the delivery fee to the subtotal', async () => {
    renderOrder();
    await waitForProduct();

    // 5 x 1200 = 6000, plus 1500 delivery.
    expect(screen.getByText(rwf(6000))).toBeInTheDocument();
    expect(screen.getByText(rwf(DELIVERY))).toBeInTheDocument();
    expect(screen.getByText(rwf(6000 + DELIVERY))).toBeInTheDocument();
  });

  it('follows the quantity', async () => {
    renderOrder();
    await waitForProduct();

    fireEvent.click(screen.getByRole('button', { name: '+' }));

    // 10 x 1200 = 12000, plus 1500 delivery.
    expect(screen.getByText(rwf(12000 + DELIVERY))).toBeInTheDocument();
  });
});

describe('the confirm button', () => {
  it('stays disabled until the Mobile Money providers have loaded', async () => {
    let release;
    getPawaPayProviders.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    renderOrder();
    await waitForProduct();

    expect(screen.getByRole('button', { name: /Loading Mobile Money options/i })).toBeDisabled();

    release(PROVIDERS);

    expect(await screen.findByRole('button', { name: /Confirm and pay via MoMo/i })).toBeEnabled();
  });

  it('is disabled when the country has no providers', async () => {
    getPawaPayProviders.mockResolvedValue({ data: { countries: [{ prefix: '250', providers: [] }] } });
    renderOrder();
    await waitForProduct();

    expect(await screen.findByRole('button', { name: /Mobile Money setup required/i })).toBeDisabled();
    expect(screen.getByText(/No providers are currently available/i)).toBeInTheDocument();
  });
});

describe('placing the order', () => {
  it('creates the order and the deposit, then confirms the payment', async () => {
    getPawaPayDepositStatus.mockResolvedValue({ data: { payment: { status: 'completed' } } });
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith({
        product_id: 'p1',
        quantity: 5,
        delivery_location: 'Rwanda',
      })
    );

    // 0788123456 with the 250 country prefix becomes 250788123456.
    await waitFor(() =>
      expect(createPawaPayDeposit).toHaveBeenCalledWith({
        order_id: 'order-1',
        phone_number: '250788123456',
        provider_code: 'MTN_MOMO_RWA',
        payment_method: 'mobile_money',
        country: 'RWA',
      })
    );

    expect(await screen.findByText(/Payment confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Total: RWF 7,500/)).toBeInTheDocument();
    expect(screen.getByText(/dep-1/)).toBeInTheDocument();
  });

  it('does not order again when a failed payment is retried', async () => {
    // A retry must reuse the order that was already created, otherwise a failed
    // payment would reserve stock a second time.
    getPawaPayDepositStatus.mockResolvedValue({
      data: { payment: { status: 'failed', failure_reason: 'Insufficient funds' } },
    });
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());
    await findFailureReason('Insufficient funds');

    fireEvent.click(screen.getByRole('button', { name: /Confirm and pay via MoMo/i }));

    await waitFor(() => expect(createPawaPayDeposit).toHaveBeenCalledTimes(2));
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it('refuses to continue without a usable provider', async () => {
    // A provider list whose entries carry no provider code leaves nothing to
    // choose, so the request must not be attempted.
    getPawaPayProviders.mockResolvedValue({
      data: { countries: [{ prefix: '250', providers: [{ displayName: 'Broken entry' }] }] },
    });
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());

    expect(await screen.findByText(/Select a Mobile Money provider/i)).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('refuses to continue without a phone number', async () => {
    mockUser = { ...RETAILER, phone: '' };
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());

    expect(await screen.findByText(/Enter a valid Mobile Money phone number/i)).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('reports a failure from the order endpoint', async () => {
    createOrder.mockRejectedValue({ response: { data: { error: 'Not enough stock' } } });
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());

    expect(await screen.findByText('Not enough stock')).toBeInTheDocument();
    expect(createPawaPayDeposit).not.toHaveBeenCalled();
  });
});

describe('payment status', () => {
  it('shows a failure from the status endpoint', async () => {
    getPawaPayDepositStatus.mockResolvedValue({
      data: { payment: { status: 'failed', failure_reason: 'Payment was declined' } },
    });
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());

    await findFailureReason('Payment was declined');
    // The status card must show the failed label, not the pending one.
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
    expect(screen.queryByText(/Payment confirmed/i)).not.toBeInTheDocument();
  });

  it('falls back to a generic message when the failure carries no reason', async () => {
    getPawaPayDepositStatus.mockResolvedValue({ data: { payment: { status: 'failed' } } });
    renderOrder();
    await waitForProduct();

    fireEvent.click(confirmButton());

    // No failure_reason is supplied, so the note under the status card falls
    // back to its default copy and only the error box carries this text.
    expect(await screen.findByText(/The payment did not complete/i)).toBeInTheDocument();
  });
});

describe('the country', () => {
  it('is derived from the delivery location', async () => {
    mockUser = { ...RETAILER, location: 'Zambia' };
    renderOrder();
    await waitForProduct();

    await waitFor(() => expect(getPawaPayProviders).toHaveBeenCalledWith('ZMB'));
  });

  it('defaults to Rwanda when the location is not one it knows', async () => {
    mockUser = { ...RETAILER, location: 'Somewhere else' };
    renderOrder();
    await waitForProduct();

    await waitFor(() => expect(getPawaPayProviders).toHaveBeenCalledWith('RWA'));
  });
});

describe('provider prediction', () => {
  it('shows the provider predicted from the phone number', async () => {
    renderOrder();
    await waitForProduct();

    // The prediction is debounced by 500ms.
    expect(await screen.findByText(/Predicted provider:/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('MTN_MOMO_RWA')).toBeInTheDocument();
  });
});
