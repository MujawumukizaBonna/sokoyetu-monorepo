import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { getMe, SESSION_ENDED_EVENT } from '../api';

jest.mock('../api', () => ({
  getMe: jest.fn(),
  SESSION_ENDED_EVENT: 'sokoyetu:session-ended',
}));

const TOKEN_KEY = 'token';
const RETAILER = { name: 'Amina', role: 'retailer' };

// A tiny consumer so the provider's value can be read and driven from a test.
function Probe() {
  const { user, loading, loginUser, logoutUser, updateUser } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.name : 'none'}</span>
      <span data-testid="role">{user ? user.role : 'none'}</span>
      <button onClick={() => loginUser('tok', RETAILER)}>login</button>
      <button onClick={logoutUser}>logout</button>
      <button onClick={() => updateUser({ name: 'Updated', role: 'retailer' })}>update</button>
    </div>
  );
}

const renderProbe = () => render(<AuthProvider><Probe /></AuthProvider>);

const settled = () => waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
});

describe('restoring a session on load', () => {
  it('finishes loading with no user when there is no token', async () => {
    renderProbe();

    await settled();

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(getMe).not.toHaveBeenCalled();
  });

  it('restores the user when a token is stored', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    getMe.mockResolvedValue({ data: RETAILER });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Amina'));
    expect(screen.getByTestId('role')).toHaveTextContent('retailer');
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('throws away a token the backend rejects', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale');
    getMe.mockRejectedValue(new Error('401 Unauthorized'));

    renderProbe();

    await settled();

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});

describe('session-ended handling', () => {
  it('drops the user when the API client announces the session ended', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    getMe.mockResolvedValue({ data: RETAILER });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Amina'));

    act(() => {
      window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('removes its listener on unmount', async () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    localStorage.setItem(TOKEN_KEY, 'tok');
    getMe.mockResolvedValue({ data: RETAILER });

    const { unmount } = renderProbe();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Amina'));
    unmount();

    const added = add.mock.calls.filter(([type]) => type === SESSION_ENDED_EVENT).length;
    const removed = remove.mock.calls.filter(([type]) => type === SESSION_ENDED_EVENT).length;
    expect(added).toBeGreaterThan(0);
    expect(removed).toBe(added);

    add.mockRestore();
    remove.mockRestore();
  });
});

describe('sign in and out', () => {
  it('loginUser stores the token and sets the user', async () => {
    renderProbe();
    await settled();

    fireEvent.click(screen.getByText('login'));

    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok');
    expect(screen.getByTestId('user')).toHaveTextContent('Amina');
  });

  it('logoutUser clears the token and the user', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    getMe.mockResolvedValue({ data: RETAILER });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Amina'));

    fireEvent.click(screen.getByText('logout'));

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('updateUser refreshes the cached user without touching the token', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    getMe.mockResolvedValue({ data: RETAILER });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Amina'));

    fireEvent.click(screen.getByText('update'));

    expect(screen.getByTestId('user')).toHaveTextContent('Updated');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok');
  });
});
