import { describe, expect, it } from 'vitest';
import { getInstallMode, isIosDevice } from './installApp';

describe('getInstallMode', () => {
  it('hides everything once installed', () => {
    expect(getInstallMode({ standalone: true, ios: true, hasPrompt: true })).toBe('installed');
  });

  it('prefers the browser prompt, then iOS instructions', () => {
    expect(getInstallMode({ standalone: false, ios: false, hasPrompt: true })).toBe('prompt');
    expect(getInstallMode({ standalone: false, ios: true, hasPrompt: false })).toBe('ios');
    expect(getInstallMode({ standalone: false, ios: false, hasPrompt: false })).toBe('unsupported');
  });
});

describe('isIosDevice', () => {
  it('detects iPhone and iPadOS (which pretends to be a Mac)', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});
