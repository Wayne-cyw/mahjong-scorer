// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './update-prompt';

type Listener = () => void;

const sw = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  register: vi.fn(),
  messageSkipWaiting: vi.fn(),
  pathname: '/',
}));

vi.mock('@serwist/window', () => ({
  Serwist: class {
    addEventListener(type: string, listener: Listener): void {
      sw.listeners.set(type, listener);
    }
    register = sw.register;
    messageSkipWaiting = sw.messageSkipWaiting;
  },
}));

vi.mock('next/navigation', () => ({ usePathname: () => sw.pathname }));

function emitWaiting(): void {
  act(() => {
    sw.listeners.get('waiting')?.();
  });
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    sw.listeners.clear();
    sw.register.mockReset().mockResolvedValue(undefined);
    sw.messageSkipWaiting.mockReset();
    sw.pathname = '/';
    vi.stubEnv('NODE_ENV', 'production');
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('registers the service worker and is hidden with no waiting worker', () => {
    render(<UpdatePrompt />);
    expect(sw.register).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/update ready/i)).toBeNull();
  });

  it('shows the bar when a worker is waiting', () => {
    render(<UpdatePrompt />);
    emitWaiting();
    expect(screen.getByText(/update ready/i)).toBeTruthy();
  });

  it('stays hidden on the hand route, then appears once the player leaves it', () => {
    sw.pathname = '/game/abc/hand';
    const { rerender } = render(<UpdatePrompt />);
    emitWaiting();
    expect(screen.queryByText(/update ready/i)).toBeNull();
    sw.pathname = '/game/abc';
    rerender(<UpdatePrompt />);
    expect(screen.getByText(/update ready/i)).toBeTruthy();
  });

  it('posts skip-waiting on accept', () => {
    render(<UpdatePrompt />);
    emitWaiting();
    fireEvent.click(screen.getByRole('button', { name: /update/i }));
    expect(sw.messageSkipWaiting).toHaveBeenCalledTimes(1);
  });

  it('reloads once the new worker takes control after accept', () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload } as unknown as Location);
    render(<UpdatePrompt />);
    emitWaiting();
    fireEvent.click(screen.getByRole('button', { name: /update/i }));
    act(() => {
      sw.listeners.get('controlling')?.();
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload on controlling without a prior accept', () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload } as unknown as Location);
    render(<UpdatePrompt />);
    emitWaiting();
    act(() => {
      sw.listeners.get('controlling')?.();
    });
    expect(reload).not.toHaveBeenCalled();
  });
});
