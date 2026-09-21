import { render, screen } from '@testing-library/react';
import App from './App';

const LANDING_HEADING = /A better way for retailers and manufacturers/i;

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('shows the landing page to a signed-out visitor', async () => {
  render(<App />);

  expect(await screen.findByText(LANDING_HEADING)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /I am a retailer/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /I am a manufacturer/i })).toBeInTheDocument();
});

test('sends a signed-out visitor away from a protected route', async () => {
  // A retailer route with no session: PrivateRoute should bounce back to '/'.
  window.history.pushState({}, '', '/retailer');

  render(<App />);

  expect(await screen.findByText(LANDING_HEADING)).toBeInTheDocument();
});

test('does not render a protected screen while there is no session', async () => {
  window.history.pushState({}, '', '/account');

  render(<App />);

  await screen.findByText(LANDING_HEADING);
  expect(screen.queryByText(/Your details/i)).not.toBeInTheDocument();
});
