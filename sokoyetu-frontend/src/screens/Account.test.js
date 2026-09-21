import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Account from './Account';
import {
  getMySupplier,
  updateMySupplier,
  updateMe,
  changePassword,
  logoutAll,
} from '../api';

jest.mock('../api', () => ({
  getMySupplier: jest.fn(),
  updateMySupplier: jest.fn(),
  updateMe: jest.fn(),
  changePassword: jest.fn(),
  logoutAll: jest.fn(),
}));

const mockLogoutUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockLoginUser = jest.fn();
let mockUser;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logoutUser: mockLogoutUser,
    updateUser: mockUpdateUser,
    loginUser: mockLoginUser,
  }),
}));

const RETAILER = {
  id: 1,
  name: 'Amina',
  role: 'retailer',
  phone: '+250788000000',
  location: '',
  created_at: '2025-01-15T00:00:00Z',
};

const renderAccount = () =>
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Account />
    </MemoryRouter>
  );

const fillPasswordFields = (current, next, confirm) => {
  fireEvent.change(screen.getByPlaceholderText('Your current password'), { target: { value: current } });
  fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: next } });
  fireEvent.change(screen.getByPlaceholderText('Repeat the new password'), { target: { value: confirm } });
};

const clickChangePassword = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { ...RETAILER };
  getMySupplier.mockResolvedValue({ data: {} });
  updateMe.mockResolvedValue({ data: {} });
  updateMySupplier.mockResolvedValue({ data: {} });
  changePassword.mockResolvedValue({ data: {} });
  logoutAll.mockResolvedValue({ data: {} });
});

describe('profile details', () => {
  it('shows the phone number as read-only', () => {
    renderAccount();

    expect(screen.getByText('+250788000000')).toBeInTheDocument();
    expect(screen.getByText(/cannot be changed here/i)).toBeInTheDocument();
  });

  it('refuses to save an empty name without calling the API', async () => {
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText(/Your name cannot be empty/i)).toBeInTheDocument();
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('saves the trimmed name and refreshes the cached user', async () => {
    updateMe.mockResolvedValue({ data: { name: 'Amina', role: 'retailer' } });
    renderAccount();
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Amina  ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ name: 'Amina', location: '' }));
    expect(mockUpdateUser).toHaveBeenCalledWith({ name: 'Amina', role: 'retailer' });
    expect(await screen.findByText(/Your details have been updated/i)).toBeInTheDocument();
  });

  it('surfaces the server message when saving fails', async () => {
    updateMe.mockRejectedValue({ response: { data: { error: 'Name is too long' } } });
    renderAccount();

    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Name is too long')).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe('changing a password', () => {
  it('requires all three fields', async () => {
    renderAccount();

    clickChangePassword();

    expect(await screen.findByText(/Fill in your current password/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rejects a new password shorter than the minimum', async () => {
    renderAccount();
    fillPasswordFields('oldpass', 'abc', 'abc');

    clickChangePassword();

    expect(await screen.findByText(/must be at least 6 characters/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    renderAccount();
    fillPasswordFields('oldpass', 'newpass', 'different');

    clickChangePassword();

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rejects a new password identical to the current one', async () => {
    renderAccount();
    fillPasswordFields('samepass', 'samepass', 'samepass');

    clickChangePassword();

    expect(await screen.findByText(/must be different from your current password/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('sends the change and stores the replacement token', async () => {
    // The password change revokes every existing token, including this tab's, so
    // the response carries a replacement that must be stored.
    changePassword.mockResolvedValue({ data: { token: 'fresh-token' } });
    renderAccount();
    fillPasswordFields('oldpass', 'newpass1', 'newpass1');

    clickChangePassword();

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'oldpass', newPassword: 'newpass1' })
    );
    expect(mockLoginUser).toHaveBeenCalledWith('fresh-token', mockUser);
    expect(await screen.findByText(/Password changed/i)).toBeInTheDocument();
  });

  it('clears the fields after a successful change', async () => {
    changePassword.mockResolvedValue({ data: { token: 'fresh-token' } });
    renderAccount();
    fillPasswordFields('oldpass', 'newpass1', 'newpass1');

    clickChangePassword();

    await screen.findByText(/Password changed/i);
    expect(screen.getByPlaceholderText('Your current password')).toHaveValue('');
    expect(screen.getByPlaceholderText('Minimum 6 characters')).toHaveValue('');
    expect(screen.getByPlaceholderText('Repeat the new password')).toHaveValue('');
  });

  it('does not touch the token when the response carries none', async () => {
    changePassword.mockResolvedValue({ data: {} });
    renderAccount();
    fillPasswordFields('oldpass', 'newpass1', 'newpass1');

    clickChangePassword();

    await screen.findByText(/Password changed/i);
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it('shows the server message and keeps the session on failure', async () => {
    changePassword.mockRejectedValue({
      response: { data: { error: 'Current password is incorrect' } },
    });
    renderAccount();
    fillPasswordFields('wrongpass', 'newpass1', 'newpass1');

    clickChangePassword();

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(mockLoginUser).not.toHaveBeenCalled();
    // The typed values stay put so the user can correct them.
    expect(screen.getByPlaceholderText('Your current password')).toHaveValue('wrongpass');
  });
});

describe('signing out of every device', () => {
  it('asks for confirmation first and does not call the API yet', async () => {
    renderAccount();
    expect(screen.queryByText(/Sign out of every device\?/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sign out of all devices/i }));

    expect(await screen.findByText(/Sign out of every device\?/i)).toBeInTheDocument();
    expect(logoutAll).not.toHaveBeenCalled();
  });

  it('cancel closes the prompt and leaves the session alone', async () => {
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /Sign out of all devices/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByText(/Sign out of every device\?/i)).not.toBeInTheDocument()
    );
    expect(logoutAll).not.toHaveBeenCalled();
    expect(mockLogoutUser).not.toHaveBeenCalled();
  });

  it('confirming revokes the sessions and then logs this device out', async () => {
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /Sign out of all devices/i }));

    fireEvent.click(await screen.findByRole('button', { name: /Yes, sign out everywhere/i }));

    await waitFor(() => expect(logoutAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockLogoutUser).toHaveBeenCalledTimes(1));
  });

  it('keeps the user signed in and reports the error when the call fails', async () => {
    logoutAll.mockRejectedValue({ response: { data: { error: 'Too many requests' } } });
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: /Sign out of all devices/i }));

    fireEvent.click(await screen.findByRole('button', { name: /Yes, sign out everywhere/i }));

    expect(await screen.findByText('Too many requests')).toBeInTheDocument();
    expect(mockLogoutUser).not.toHaveBeenCalled();
  });
});

describe('business profile (manufacturer only)', () => {
  beforeEach(() => {
    mockUser = { ...RETAILER, name: 'Kigali Dairy', role: 'manufacturer' };
  });

  it('is not shown to a retailer', () => {
    mockUser = { ...RETAILER };
    renderAccount();

    expect(screen.queryByText(/Business profile/i)).not.toBeInTheDocument();
    expect(getMySupplier).not.toHaveBeenCalled();
  });

  it('loads the existing profile for a manufacturer', async () => {
    getMySupplier.mockResolvedValue({
      data: { name: 'Kigali Dairy Works', category: 'Food & beverage', description: 'Milk', location: 'Kigali', emoji: '🥛' },
    });

    renderAccount();

    expect(await screen.findByDisplayValue('Kigali Dairy Works')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kigali')).toBeInTheDocument();
  });

  it('reports a profile that cannot be loaded', async () => {
    getMySupplier.mockRejectedValue({ response: { data: { error: 'Supplier profile not found' } } });

    renderAccount();

    expect(await screen.findByText('Supplier profile not found')).toBeInTheDocument();
  });

  it('refuses to save an empty business name', async () => {
    getMySupplier.mockResolvedValue({ data: { name: 'Kigali Dairy Works', category: 'Food & beverage', emoji: '🥛' } });
    renderAccount();
    await screen.findByDisplayValue('Kigali Dairy Works');

    fireEvent.change(screen.getByPlaceholderText('e.g. Kigali Dairy Works'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save business profile' }));

    expect(await screen.findByText(/Business name is required/i)).toBeInTheDocument();
    expect(updateMySupplier).not.toHaveBeenCalled();
  });

  it('saves the trimmed business profile', async () => {
    getMySupplier.mockResolvedValue({
      data: { name: 'Kigali Dairy Works', category: 'Food & beverage', description: 'Milk', location: 'Kigali', emoji: '🥛' },
    });
    renderAccount();
    await screen.findByDisplayValue('Kigali Dairy Works');

    fireEvent.change(screen.getByPlaceholderText('e.g. Kigali Dairy Works'), { target: { value: '  Kigali Dairy  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save business profile' }));

    await waitFor(() =>
      expect(updateMySupplier).toHaveBeenCalledWith({
        name: 'Kigali Dairy',
        category: 'Food & beverage',
        description: 'Milk',
        location: 'Kigali',
        emoji: '🥛',
      })
    );
    expect(await screen.findByText(/Business profile updated/i)).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('logs out from the sidebar', () => {
    renderAccount();

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(mockLogoutUser).toHaveBeenCalledTimes(1);
  });
});
