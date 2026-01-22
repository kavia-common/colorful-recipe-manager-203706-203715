/**
 * API configuration helpers for the Recipe frontend.
 *
 * Create React App exposes environment variables prefixed with `REACT_APP_`.
 */

/**
 * PUBLIC_INTERFACE
 * Resolve the backend API base URL from environment variables.
 *
 * Preference order:
 * - REACT_APP_API_BASE (container-provided)
 * - REACT_APP_BACKEND_URL (container-provided)
 * - REACT_APP_API_BASE_URL (legacy/older template)
 * - http://localhost:3001 (local dev fallback)
 *
 * The returned URL is normalized without a trailing slash.
 *
 * @returns {string} Backend API base URL (e.g. "http://localhost:3001")
 */
export function getApiBaseUrl() {
  const raw =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    'http://localhost:3001';

  // Trim whitespace and remove trailing slash for stable URL joining.
  return String(raw).trim().replace(/\/$/, '');
}
