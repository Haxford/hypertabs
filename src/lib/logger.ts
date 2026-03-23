/**
 * Logger - Production-Ready Logging Utility
 *
 * Provides structured, configurable logging for all HyperTabs modules.
 * Each module creates its own named logger instance via the factory function.
 *
 * Key features:
 * - Configurable log levels: debug, info, warn, error, silent
 * - Module-prefixed messages for easy filtering in devtools
 * - Silent debug/info in production builds by default
 * - Factory pattern for per-module logger instances
 */

// =============================================================================
// TYPES
// =============================================================================

/** Available log levels, ordered from most to least verbose */
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** A logger instance bound to a specific module name */
interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

// =============================================================================
// LOG LEVEL CONFIGURATION
// =============================================================================

/** Numeric priority for each level — higher means less verbose */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Detects whether we're running in a development build.
 * Vite replaces `import.meta.env.DEV` at compile time.
 */
function isDevEnvironment(): boolean {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
}

/**
 * Default to 'warn' in production so debug/info are silent,
 * and 'debug' in development so everything is visible.
 */
let currentLevel: LogLevel = isDevEnvironment() ? 'debug' : 'warn';

/**
 * Sets the global log level for all logger instances
 *
 * @param level - The minimum level to output
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Gets the current global log level
 *
 * @returns The active log level
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/**
 * Checks whether a message at the given level should be emitted
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

// =============================================================================
// LOGGER FACTORY
// =============================================================================

/**
 * Creates a named logger instance for a module.
 *
 * Usage:
 * ```ts
 * const log = createLogger('Harpoon');
 * log.info('Marked tab to slot', slotId);
 * // => [HyperTabs] Harpoon: Marked tab to slot 3
 * ```
 *
 * @param module - Human-readable module name used in the log prefix
 * @returns A Logger with debug, info, warn, and error methods
 */
export function createLogger(module: string): Logger {
  const prefix = `[HyperTabs] ${module}:`;

  return {
    debug(...args: unknown[]) {
      if (shouldLog('debug')) {
        // eslint-disable-next-line no-console
        console.log(prefix, ...args);
      }
    },
    info(...args: unknown[]) {
      if (shouldLog('info')) {
        // eslint-disable-next-line no-console
        console.log(prefix, ...args);
      }
    },
    warn(...args: unknown[]) {
      if (shouldLog('warn')) {
        // eslint-disable-next-line no-console
        console.warn(prefix, ...args);
      }
    },
    error(...args: unknown[]) {
      if (shouldLog('error')) {
        // eslint-disable-next-line no-console
        console.error(prefix, ...args);
      }
    },
  };
}
