// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecognizeError, type RecognitionResult } from '@/lib/recognition';
import { recognize } from '@/lib/recognition/client/recognize-client';
import { resizeForUpload } from '@/lib/recognition/client/resize';
import { CameraCapture } from '@/components/hand/camera-capture';

vi.mock('@/lib/recognition/client/recognize-client', () => ({ recognize: vi.fn() }));
vi.mock('@/lib/recognition/client/resize', () => ({ resizeForUpload: vi.fn() }));

const result: RecognitionResult = {
  isMahjongHand: true,
  concealed: ['m1', 'm2', 'm3'],
  melds: [],
  bonus: [],
  uncertain: [],
  warnings: [],
};

const resized = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
const photo = new File([new Uint8Array([9])], 'p.jpg', { type: 'image/jpeg' });

const fileInput = (): HTMLInputElement =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

const choosePhoto = async (): Promise<void> => {
  await act(async () => {
    fireEvent.change(fileInput(), { target: { files: [photo] } });
  });
};

const setup = () => {
  const onRecognized = vi.fn();
  const onFailure = vi.fn();
  const onSkip = vi.fn();
  render(<CameraCapture onRecognized={onRecognized} onFailure={onFailure} onSkip={onSkip} />);
  return { onRecognized, onFailure, onSkip };
};

describe('CameraCapture', () => {
  beforeEach(() => {
    vi.mocked(resizeForUpload).mockResolvedValue(resized);
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the layout guide first and only then opens the camera input', () => {
    setup();
    expect(screen.getByText(/concealed/i)).toBeInTheDocument();
    expect(screen.getByText(/exposed/i)).toBeInTheDocument();
    expect(screen.getByText(/flowers/i)).toBeInTheDocument();
    const input = fileInput();
    expect(input.getAttribute('accept')).toBe('image/*');
    expect(input.getAttribute('capture')).toBe('environment');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('always offers manual entry', () => {
    const { onSkip } = setup();
    fireEvent.click(screen.getByRole('button', { name: /skip, enter manually/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('resizes, recognizes and hands over the result with the photo url', async () => {
    vi.mocked(recognize).mockResolvedValue(result);
    const { onRecognized } = setup();
    await choosePhoto();
    await waitFor(() => expect(onRecognized).toHaveBeenCalled());
    expect(resizeForUpload).toHaveBeenCalledWith(photo);
    expect(recognize).toHaveBeenCalledWith(resized, expect.any(AbortSignal));
    expect(onRecognized).toHaveBeenCalledWith(result, 'blob:photo');
  });

  it('shows a friendly message and stays put when the photo has no hand', async () => {
    vi.mocked(recognize).mockResolvedValue({ ...result, isMahjongHand: false });
    const { onRecognized, onFailure } = setup();
    await choosePhoto();
    expect(await screen.findByText(/couldn.t see a mahjong hand/i)).toBeInTheDocument();
    expect(onRecognized).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    expect(screen.getByRole('button', { name: /take photo|try again/i })).toBeInTheDocument();
  });

  it('falls back with the photo kept when recognition fails', async () => {
    vi.mocked(recognize).mockRejectedValue(new RecognizeError('timeout'));
    const { onFailure, onRecognized } = setup();
    await choosePhoto();
    await waitFor(() => expect(onFailure).toHaveBeenCalled());
    expect(onFailure).toHaveBeenCalledWith('timeout', 'blob:photo');
    expect(onRecognized).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('falls back when resizing itself fails', async () => {
    vi.mocked(resizeForUpload).mockRejectedValue(new Error('decode'));
    const { onFailure } = setup();
    await choosePhoto();
    // A decode failure is the file's fault, not connectivity, so it must not say "offline".
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith('not-a-photo', 'blob:photo'));
    expect(recognize).not.toHaveBeenCalled();
  });

  it('cancels the upload when the player leaves while the photo is being read', async () => {
    let seen: AbortSignal | undefined;
    vi.mocked(recognize).mockImplementation((_blob, signal) => {
      seen = signal;
      return new Promise(() => {});
    });
    const { unmount } = (() => {
      const handlers = setup();
      return { ...handlers, unmount: cleanup };
    })();
    await choosePhoto();
    await waitFor(() => expect(seen).toBeDefined());
    expect(seen?.aborted).toBe(false);
    unmount();
    expect(seen?.aborted).toBe(true);
  });

  it('revokes an unclaimed photo url on unmount', async () => {
    let finish: (r: RecognitionResult) => void = () => undefined;
    vi.mocked(recognize).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { onRecognized } = setup();
    await choosePhoto();
    cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    await act(async () => finish(result));
    expect(onRecognized).not.toHaveBeenCalled();
  });
});
