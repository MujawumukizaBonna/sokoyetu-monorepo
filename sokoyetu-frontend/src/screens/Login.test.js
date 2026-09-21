import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import Login from './Login';
import { login } from '../api';

jest.mock('../api', () => ({
  login: jest.fn(),
}));

const mockLoginUser = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ loginUser: mockLoginUser }),
}));

const renderLogin = (role = 'retailer') =>
  render(
    <MemoryRouter initialEntries={[`/login?role=${role}`]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/retailer" element={<div>retailer home</div>} />
        <Route path="/manufacturer" element={<div>manufacturer home</div>} />
      </Routes>
    </MemoryRouter>
  );

const signIn = () => fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

const fill = (phone, password) => {
  fireEvent.change(screen.getByPlaceholderText('e.g. 0788123456'), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: password } });
};

beforeEach(() => {
  jest.clearAllMocks();
  login.mockResolvedValue({
    data: { token: 'tok', user: { name: 'Amina', role: 'retailer' } },
  });
});

describe('signing in', () => {
  it('asks for both fields before calling the API', async () => {
    renderLogin();

    signIn();

    expect(await screen.findByText(/Please enter your phone number and password/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('sends the credentials and signs the user in', async () => {
    renderLogin();
    fill('0788123456', 'secret1');

    signIn();

    await waitFor(() => expect(login).toHaveBeenCalledWith({ phone: '0788123456', password: 'secret1' }));
    expect(mockLoginUser).toHaveBeenCalledWith('tok', { name: 'Amina', role: 'retailer' });
  });

  it('lands a retailer on the retailer home', async () => {
    renderLogin('retailer');
    fill('0788123456', 'secret1');

    signIn();

    expect(await screen.findByText('retailer home')).toBeInTheDocument();
  });

  it('lands a manufacturer on the manufacturer home', async () => {
    login.mockResolvedValue({
      data: { token: 'tok', user: { name: 'Inyange', role: 'manufacturer' } },
    });
    renderLogin('manufacturer');
    fill('0788123456', 'secret1');

    signIn();

    expect(await screen.findByText('manufacturer home')).toBeInTheDocument();
  });

  it('submits when Enter is pressed in the password field', async () => {
    renderLogin();
    fill('0788123456', 'secret1');

    fireEvent.keyDown(screen.getByPlaceholderText('Enter your password'), { key: 'Enter' });

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
  });
});

describe('role mismatch', () => {
  it('refuses to sign in when the account belongs to the other role', async () => {
    // The user picked "retailer" but the phone number belongs to a manufacturer.
    login.mockResolvedValue({
      data: { token: 'tok', user: { name: 'Inyange', role: 'manufacturer' } },
    });
    renderLogin('retailer');
    fill('0788123456', 'secret1');

    signIn();

    expect(await screen.findByText(/registered as a manufacturer/i)).toBeInTheDocument();
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it('does not navigate away on a mismatch', async () => {
    login.mockResolvedValue({
      data: { token: 'tok', user: { name: 'Amina', role: 'retailer' } },
    });
    renderLogin('manufacturer');
    fill('0788123456', 'secret1');

    signIn();

    expect(await screen.findByText(/registered as a retailer/i)).toBeInTheDocument();
    expect(screen.queryByText('retailer home')).not.toBeInTheDocument();
    expect(screen.queryByText('manufacturer home')).not.toBeInTheDocument();
  });
});

describe('sign-in failures', () => {
  it('shows the server message', async () => {
    login.mockRejectedValue({ response: { data: { error: 'Invalid phone number or password' } } });
    renderLogin();
    fill('0788123456', 'wrongpass');

    signIn();

    expect(await screen.findByText('Invalid phone number or password')).toBeInTheDocument();
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it('shows the throttle message the backend returns on 429', async () => {
    login.mockRejectedValue({
      response: { status: 429, data: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' } },
    });
    renderLogin();
    fill('0788123456', 'secret1');

    signIn();

    expect(await screen.findByText(/Too many sign-in attempts/i)).toBeInTheDocument();
  });

  it('falls back to a generic message when the response carries none', async () => {
    login.mockRejectedValue(new Error('Network Error'));
    renderLogin();
    fill('0788123456', 'secret1');

    signIn();

    expect(await screen.findByText(/Login failed/i)).toBeInTheDocument();
  });
});
