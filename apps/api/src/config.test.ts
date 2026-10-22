import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('config', () => {
  it('treats blank settings from Docker Compose as unset', () => {
    const config = loadConfig({
      SPEECH_URL: '',
      LANGUAGETOOL_URL: '',
      SINGLE_INSTITUTE_NAME: '',
      SMTP_URL: '',
      SPEECH_DAILY_LIMIT: '',
      INCLUDE_UNREVIEWED: '',
      PUBLIC_API_URL: '',
    });
    expect(config.SPEECH_URL).toBeUndefined();
    expect(config.LANGUAGETOOL_URL).toBeUndefined();
    expect(config.SINGLE_INSTITUTE_NAME).toBeUndefined();
    expect(config.SMTP_URL).toBeUndefined();
    expect(config.SPEECH_DAILY_LIMIT).toBe(30);
    expect(config.INCLUDE_UNREVIEWED).toBe(false);
    expect(config.PUBLIC_API_URL).toBe('http://localhost:3000');
  });

  it('still reads settings that are given', () => {
    const config = loadConfig({ SPEECH_URL: 'http://speech:8000', SPEECH_DAILY_LIMIT: '5' });
    expect(config.SPEECH_URL).toBe('http://speech:8000');
    expect(config.SPEECH_DAILY_LIMIT).toBe(5);
  });
});
