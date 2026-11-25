import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Component tests exercise the browser voice, whatever has been recorded.
vi.mock('../../src/voice/manifest.json', () => ({
  default: { voiceId: '', model: '', clips: {} },
}));
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
