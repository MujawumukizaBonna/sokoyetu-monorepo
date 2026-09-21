import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import Register from './Register';
import { register } from '../api';

jest.mock('../api', () => ({
  register: jest.fn(),
}));

const mockLoginUser = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ loginUser: mockLoginUser }),
}));

const renderRegister = (role = 'retailer') =>
  render(
    <MemoryRouter initialEntries={[`/register?role=${role}`]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/retailer" element={<div>retailer home</div>} />
        <Route path="/manufacturer" element={<div>manufacturer home</div>} />
      </Routes>
    </MemoryRouter>
  );

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

const fill = ({ name, phone, district, password, namePlaceholder = 'e.g. Amina Uwimana' }) => {
  if (name !== undefined) {
    fireEvent.change(screen.getByPlaceholderText(namePlaceholder), { target: { value: name } });
  }
  if (phone !== undefined) {
    fireEvent.change(screen.getByPlaceholderText('e.g. 0788123456'), { target: { value: phone } });
  }
  if (district !== undefined) {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: district } });
  }
  if (password !== undefined) {
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: password } });
  }
};

const COMPLETE_FORM = { name: 'Amina Uwimana', phone: '0788123456', district: 'Gasabo', password: 'secret1' };

beforeEach(() => {
  jest.clearAllMocks();
  register.mockResolvedValue({
    data: { token: 'tok', user: { name: 'Amina Uwimana', role: 'retailer' } },
  });
});

describe('creating an account', () => {
  it('asks for every field before calling the API', async () => {
    renderRegister();

    submit();

    expect(await screen.findByText(/Please fill in all fields/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than six characters', async () => {
    renderRegister();
    fill({ ...COMPLETE_FORM, password: 'abcde' });

    submit();

    expect(await screen.findByText(/must be at least 6 characters/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers a retailer and signs them in', async () => {
    renderRegister('retailer');
    fill(COMPLETE_FORM);

    submit();

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        name: 'Amina Uwimana',
        phone: '0788123456',
        password: 'secret1',
        location: 'Gasabo',
        role: 'retailer',
      })
    );
    expect(mockLoginUser).toHaveBeenCalledWith('tok', { name: 'Amina Uwimana', role: 'retailer' });
    expect(await screen.findByText('retailer home')).toBeInTheDocument();
  });

  it('registers a manufacturer with the manufacturer role', async () => {
    register.mockResolvedValue({
      data: { token: 'tok', user: { name: 'Inyange Industries', role: 'manufacturer' } },
    });
    renderRegister('manufacturer');
    fill({ ...COMPLETE_FORM, name: 'Inyange Industries', namePlaceholder: 'e.g. Inyange Industries' });

    submit();

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'manufacturer' }))
    );
    expect(await screen.findByText('manufacturer home')).toBeInTheDocument();
  });
});

describe('registration failures', () => {
  it('shows the server message when the phone is already taken', async () => {
    register.mockRejectedValue({ response: { data: { error: 'Phone number already registered' } } });
    renderRegister();
    fill(COMPLETE_FORM);

    submit();

    expect(await screen.findByText('Phone number already registered')).toBeInTheDocument();
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the response carries none', async () => {
    register.mockRejectedValue(new Error('Network Error'));
    renderRegister();
    fill(COMPLETE_FORM);

    submit();

    expect(await screen.findByText(/Registration failed/i)).toBeInTheDocument();
  });
});

describe('role-specific copy', () => {
  it('asks a retailer for their name and district', () => {
    renderRegister('retailer');

    expect(screen.getByPlaceholderText('e.g. Amina Uwimana')).toBeInTheDocument();
    expect(screen.getByText(/Your district/i)).toBeInTheDocument();
  });

  it('asks a manufacturer for a company name and location', () => {
    renderRegister('manufacturer');

    expect(screen.getByPlaceholderText('e.g. Inyange Industries')).toBeInTheDocument();
    expect(screen.getByText(/Company location/i)).toBeInTheDocument();
  });
});
