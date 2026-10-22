import { describe, expect, it } from 'vitest';
import { micError } from './micError.ts';

describe('micError', () => {
  it('names the cause for each getUserMedia error', () => {
    expect(micError(new DOMException('', 'NotAllowedError'))).toMatch(/Allow microphone access/);
    expect(micError(new DOMException('', 'NotFoundError'))).toMatch(/No microphone was found/);
    expect(micError(new DOMException('', 'NotReadableError'))).toMatch(/busy/);
    expect(micError(new DOMException('', 'WeirdError'))).toMatch(/\(WeirdError\)/);
    expect(micError(new Error('x'))).toMatch(/could not start\./);
  });
});
