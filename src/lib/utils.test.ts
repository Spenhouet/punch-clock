import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps custom text sizes next to text colors', () => {
    expect(cn('text-caption', 'text-primary')).toBe('text-caption text-primary');
    expect(cn('text-2xs font-medium', 'text-positive')).toBe('text-2xs font-medium text-positive');
  });
  it('still merges conflicting sizes', () => {
    expect(cn('text-caption', 'text-sm')).toBe('text-sm');
  });
});
