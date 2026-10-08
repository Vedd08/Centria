import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders correctly with given label', () => {
    render(<StatusBadge label="Completed" variant="success" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
