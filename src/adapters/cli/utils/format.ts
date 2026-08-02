// ============================================================================
// FILE: src/adapters/cli/utils/format.ts
// ============================================================================

/**
 * Transforms raw byte numbers into clean, human-readable file strings.
 * Dynamically hides trailing `.0` decimals across all units for clean alignment metrics.
 */
export function formatBytes(bytes: number): string {
  const isNegative = bytes < 0;
  const absBytes = Math.abs(bytes);
  
  if (absBytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  // Clamp array bounds to guard against out-of-bounds undefined mutations
  const i = Math.min(
    Math.floor(Math.log(absBytes) / Math.log(1024)), 
    units.length - 1
  );
  
  const value = absBytes / Math.pow(1024, i);
  
  // Format to 1 decimal place, but strip it if it is a whole number (e.g., "1 KB" instead of "1.0 KB")
  let formattedValue = value.toFixed(1);
  if (formattedValue.endsWith('.0') || i === 0) {
    formattedValue = Math.round(value).toString();
  }
  
  return `${isNegative ? '-' : ''}${formattedValue} ${units[i]}`;
}

/**
 * Formats engine compilation cycles down to microsecond configurations.
 * Prevents high-precision times from rounding down to "0µs".
 */
export function formatDuration(ms: number): string {
  if (ms === 0) return '0ms';
  
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);
  
  let formattedResult = '';
  
  if (absMs < 1) {
    const microseconds = absMs * 1000;
    if (microseconds > 0 && microseconds < 1) {
      // Prevent rounding down to 0µs for extremely fast cache checks
      formattedResult = '<1µs';
    } else {
      formattedResult = `${microseconds.toFixed(0)}µs`;
    }
  } else if (absMs < 1000) {
    // Round to 1 decimal place, stripping trailing zeros (e.g., "45ms" instead of "45.0ms")
    const rounded = absMs.toFixed(1);
    formattedResult = rounded.endsWith('.0') 
      ? `${Math.round(absMs)}ms` 
      : `${rounded}ms`;
  } else {
    // Standard second conversion
    const roundedSeconds = (absMs / 1000).toFixed(2);
    formattedResult = roundedSeconds.endsWith('.00')
      ? `${Math.round(absMs / 1000)}s`
      : `${roundedSeconds}s`;
  }
  
  return `${isNegative ? '-' : ''}${formattedResult}`;
}

export default {
  formatBytes,
  formatDuration
};