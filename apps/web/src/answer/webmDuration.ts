import type { SyntheticEvent } from 'react';

/**
 * Chrome's MediaRecorder writes WebM without a duration, so the player shows 0:00 and cannot be
 * moved through. Seeking far past the end makes the browser read the whole file and learn the
 * duration; then go back to the start. Use as an <audio> onLoadedMetadata handler.
 */
export function fixWebmDuration(e: SyntheticEvent<HTMLAudioElement>) {
  const audio = e.currentTarget;
  if (audio.duration !== Infinity) return;
  const back = () => {
    if (audio.duration === Infinity) return;
    audio.removeEventListener('durationchange', back);
    audio.currentTime = 0;
  };
  audio.addEventListener('durationchange', back);
  audio.currentTime = 1e101;
}
