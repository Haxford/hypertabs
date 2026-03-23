import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, getLogLevel } from '../logger';

describe('createLogger', () => {
  it('returns an object with debug, info, warn, and error methods', () => {
    const log = createLogger('Test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });
});

describe('setLogLevel / getLogLevel', () => {
  afterEach(() => {
    // Reset to a known state after each test
    setLogLevel('warn');
  });

  it('sets and gets the log level', () => {
    setLogLevel('error');
    expect(getLogLevel()).toBe('error');

    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');
  });
});

describe('log level filtering', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLogLevel('warn');
  });

  it('at "debug" level, all messages are emitted', () => {
    setLogLevel('debug');
    const log = createLogger('Mod');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(logSpy).toHaveBeenCalledTimes(2);   // debug + info use console.log
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('at "warn" level, debug and info are suppressed', () => {
    setLogLevel('warn');
    const log = createLogger('Mod');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('at "error" level, only error messages are emitted', () => {
    setLogLevel('error');
    const log = createLogger('Mod');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('at "silent" level, nothing is emitted', () => {
    setLogLevel('silent');
    const log = createLogger('Mod');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('prefixes messages with [HyperTabs] ModuleName:', () => {
    setLogLevel('debug');
    const log = createLogger('Harpoon');

    log.info('hello', 42);

    expect(logSpy).toHaveBeenCalledWith('[HyperTabs] Harpoon:', 'hello', 42);
  });
});
