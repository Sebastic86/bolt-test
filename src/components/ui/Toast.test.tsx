import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from './Toast';
import { ToastOptions, useToast } from './toastContext';

const Trigger = ({ options }: { options: ToastOptions[] }) => {
  const { toast } = useToast();
  return <button onClick={() => options.forEach(toast)}>fire</button>;
};

const renderWith = (options: ToastOptions[]) =>
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('renders into a polite live region with title and detail', () => {
    renderWith([{ title: 'Hat-trick of wins', detail: 'Ana has won 3 matches tonight.', variant: 'milestone' }]);
    fireEvent.click(screen.getByText('fire'));
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Hat-trick of wins');
    expect(region).toHaveTextContent('Ana has won 3 matches tonight.');
  });

  it('dismisses on close button and on tap', () => {
    renderWith([{ title: 'One', variant: 'info' }, { title: 'Two', variant: 'error' }]);
    fireEvent.click(screen.getByText('fire'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]);
    expect(screen.queryByText('Two')).not.toBeInTheDocument(); // newest is on top
    fireEvent.click(screen.getByText('One'));
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the variant duration', () => {
    vi.useFakeTimers();
    renderWith([{ title: 'Saved', variant: 'success' }, { title: 'Big moment', variant: 'milestone' }]);
    fireEvent.click(screen.getByText('fire'));
    act(() => { vi.advanceTimersByTime(4100); });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Big moment')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Big moment')).not.toBeInTheDocument();
  });

  it('shows at most 3 (newest first) and queues the rest; ignores duplicate ids', () => {
    renderWith([
      ...['A', 'B', 'C', 'D'].map(title => ({ title, variant: 'info' as const })),
      { title: 'D again', variant: 'info', id: 'dup' },
      { title: 'D dup', variant: 'info', id: 'dup' },
    ]);
    fireEvent.click(screen.getByText('fire'));
    const titles = () => screen.getAllByRole('button', { name: 'Dismiss notification' }).length;
    expect(titles()).toBe(3);
    expect(screen.getByText('D again')).toBeInTheDocument();
    expect(screen.queryByText('D dup')).not.toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('D again'));
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
