/**
 * Generate X-Client-Transaction-Id header
 * 
 * This mimics the transaction ID format used by X's web client
 * to help avoid bot detection.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function randomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

function encodeTimestamp(): string {
  const now = Date.now();
  // X uses a specific encoding for timestamps in transaction IDs
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(now));
  return buf.toString('base64url').replace(/=/g, '');
}

/**
 * Generate a transaction ID that matches X's expected format
 * Format appears to be: base64(timestamp + random + checksum)
 */
export function generateTransactionId(): string {
  const timestamp = encodeTimestamp();
  const random = randomString(16);
  const combined = `${timestamp}${random}`;
  
  // Add padding/checksum like X does
  const checksum = randomString(8);
  return `${combined}${checksum}`;
}

/**
 * Generate UI metrics for login flows (from twikit research)
 * This is used during authentication to appear more human-like
 */
export function generateUiMetrics(): Record<string, unknown> {
  return {
    rf: {
      ae: randomString(32),
      af: randomString(32),
    },
    s: Date.now().toString(16),
  };
}
