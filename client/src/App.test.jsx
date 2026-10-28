import { render, screen } from '@testing-library/react';
import App from './App.jsx';

test('shows the platform title', () => {
  globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve({ status: 'ok' }) });
  render(<App />);
  expect(screen.getByRole('heading', { name: /research collaboration/i })).toBeInTheDocument();
});
