import API, { SESSION_ENDED_EVENT, changePassword, logoutAll } from './index';

const TOKEN_KEY = 'token';

// Drive the real interceptor chain by swapping axios's adapter, rather than
// poking at interceptor internals. Anything the client does on the way out or
// back is therefore exercised for real.
const failWith = (status, data) => {
  API.defaults.adapter = async (config) => {
    const error = new Error(`Request failed with status code ${status}`);
    error.config = config;
    error.response = { status, data, config, headers: {}, statusText: '' };
    throw error;
  };
};

const succeedWith = (data, onConfig) => {
  API.defaults.adapter = async (config) => {
    if (onConfig) onConfig(config);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
};

const headerValue = (headers, name) =>
  typeof headers?.get === 'function' ? headers.get(name) : headers?.[name];

beforeEach(() => {
  localStorage.clear();
});

describe('session-ended signal', () => {
  const watchForSessionEnded = () => {
    const seen = [];
    const listener = (event) => seen.push(event.type);
    window.addEventListener(SESSION_ENDED_EVENT, listener);
    return { seen, stop: () => window.removeEventListener(SESSION_ENDED_EVENT, listener) };
  };

  it('signs the user out when the backend answers 401 with code SESSION_INVALID', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token');
    failWith(401, { error: 'Your session has ended. Please sign in again.', code: 'SESSION_INVALID' });
    const watcher = watchForSessionEnded();

    await expect(changePassword({})).rejects.toBeTruthy();

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(watcher.seen).toContain(SESSION_ENDED_EVENT);
    watcher.stop();
  });

  it('leaves the session alone on a plain 401', async () => {
    // A wrong current password must not log anyone out - that is the whole
    // reason the backend sends a distinct code.
    localStorage.setItem(TOKEN_KEY, 'a-token');
    failWith(401, { error: 'Current password is incorrect' });
    const watcher = watchForSessionEnded();

    await expect(changePassword({})).rejects.toBeTruthy();

    expect(localStorage.getItem(TOKEN_KEY)).toBe('a-token');
    expect(watcher.seen).not.toContain(SESSION_ENDED_EVENT);
    watcher.stop();
  });

  it('ignores a 401 carrying an unrelated code', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token');
    failWith(401, { code: 'SOMETHING_ELSE' });

    await expect(changePassword({})).rejects.toBeTruthy();

    expect(localStorage.getItem(TOKEN_KEY)).toBe('a-token');
  });

  it('does not sign the user out on other error statuses', async () => {
    localStorage.setItem(TOKEN_KEY, 'a-token');
    failWith(500, { error: 'boom' });

    await expect(changePassword({})).rejects.toBeTruthy();

    expect(localStorage.getItem(TOKEN_KEY)).toBe('a-token');
  });

  it('still rejects, so callers can show their own message', async () => {
    failWith(401, { error: 'nope' });

    await expect(changePassword({})).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});

describe('request interceptor', () => {
  it('attaches the stored token as a Bearer header', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok123');
    let seen = null;
    succeedWith({}, (config) => {
      seen = config;
    });

    await changePassword({});

    expect(headerValue(seen.headers, 'Authorization')).toBe('Bearer tok123');
  });

  it('sends no Authorization header when there is no token', async () => {
    let seen = null;
    succeedWith({}, (config) => {
      seen = config;
    });

    await changePassword({});

    expect(headerValue(seen.headers, 'Authorization')).toBeUndefined();
  });
});

describe('auth endpoints', () => {
  it('sends the password change to PUT /api/auth/password', async () => {
    const put = jest.spyOn(API, 'put').mockResolvedValue({ data: {} });
    const payload = { currentPassword: 'old-one', newPassword: 'new-one' };

    await changePassword(payload);

    expect(put).toHaveBeenCalledWith('/api/auth/password', payload);
    put.mockRestore();
  });

  it('sends sign-out-everywhere to POST /api/auth/logout-all', async () => {
    const post = jest.spyOn(API, 'post').mockResolvedValue({ data: {} });

    await logoutAll();

    expect(post).toHaveBeenCalledWith('/api/auth/logout-all');
    post.mockRestore();
  });
});
