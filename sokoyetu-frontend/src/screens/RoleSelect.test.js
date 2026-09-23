import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import RoleSelect from './RoleSelect';

let mockUser;

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Renders the path and query so a navigation target can be asserted exactly,
// including the ?role= the landing page attaches.
const ShowLocation = () => {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
};

const renderRoleSelect = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/login" element={<ShowLocation />} />
        <Route path="/retailer" element={<div>retailer home</div>} />
        <Route path="/manufacturer" element={<div>manufacturer home</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
});

describe('the landing page', () => {
  it('leads with the value proposition and both roles', () => {
    renderRoleSelect();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A better way for retailers and manufacturers to work together.'
    );
    expect(screen.getByRole('button', { name: 'I am a retailer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I am a manufacturer' })).toBeInTheDocument();
  });

  it('lists the features', () => {
    renderRoleSelect();

    for (const title of [
      'Faster ordering',
      'Simple manufacturer dashboard',
      'Built for every screen',
      'Role-based access',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('lists the steps', () => {
    renderRoleSelect();

    for (const title of ['Choose your role', 'Explore or publish', 'Keep everything in sync']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });
});

describe('a signed-out visitor', () => {
  it('stays on the landing page', () => {
    renderRoleSelect();

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('retailer home')).not.toBeInTheDocument();
    expect(screen.queryByText('manufacturer home')).not.toBeInTheDocument();
  });
});

describe('the calls to action', () => {
  it('sends a retailer to the retailer sign-in', async () => {
    renderRoleSelect();

    fireEvent.click(screen.getByRole('button', { name: 'I am a retailer' }));

    expect(await screen.findByText('/login?role=retailer')).toBeInTheDocument();
  });

  it('sends a manufacturer to the manufacturer sign-in', async () => {
    renderRoleSelect();

    fireEvent.click(screen.getByRole('button', { name: 'I am a manufacturer' }));

    expect(await screen.findByText('/login?role=manufacturer')).toBeInTheDocument();
  });

  it('defaults the header button to the retailer flow', async () => {
    renderRoleSelect();

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));

    expect(await screen.findByText('/login?role=retailer')).toBeInTheDocument();
  });

  it('carries the role from the closing section too', async () => {
    renderRoleSelect();

    fireEvent.click(screen.getByRole('button', { name: 'Start as manufacturer' }));

    expect(await screen.findByText('/login?role=manufacturer')).toBeInTheDocument();
  });
});

describe('a visitor who is already signed in', () => {
  it('sends a retailer straight to the retailer home', async () => {
    mockUser = { id: 1, name: 'Amina', role: 'retailer' };
    renderRoleSelect();

    expect(await screen.findByText('retailer home')).toBeInTheDocument();
  });

  it('sends a manufacturer straight to the manufacturer home', async () => {
    // Anything that is not "retailer" is treated as a manufacturer. That is only
    // safe because users.role is constrained to these two values in the schema:
    // an unknown role would loop, since /manufacturer's guard bounces it back to
    // "/", which redirects to /manufacturer again.
    mockUser = { id: 2, name: 'Kigali Dairy Works', role: 'manufacturer' };
    renderRoleSelect();

    expect(await screen.findByText('manufacturer home')).toBeInTheDocument();
  });
});
