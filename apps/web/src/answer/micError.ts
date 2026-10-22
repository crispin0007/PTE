/** What went wrong opening the microphone, from the getUserMedia error name. */
export function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Allow microphone access in your browser to answer speaking questions (the microphone icon in the address bar). Nothing is uploaded unless you choose to save a recording.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Plug one in or turn it on, then press Start again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is busy or failed to start. Close other apps that use it (Zoom, Discord, a noise-cancelling utility), or pick another microphone from the icon in the address bar, then press Start again.';
    default:
      return `The microphone could not start${name ? ` (${name})` : ''}. Check your browser's microphone setting, then press Start again.`;
  }
}
