import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { ApplicationServerKeys, generatePushHTTPRequest } from 'https://esm.sh/webpush-webcrypto@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

// Convert standard base64 to base64url
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Convert base64url to standard base64
function fromBase64Url(base64url: string): string {
  // Replace base64url characters with standard base64
  let standard = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const paddingNeeded = (4 - (standard.length % 4)) % 4;
  return standard + '='.repeat(paddingNeeded);
}

// Convert base64url or standard base64 to ArrayBuffer
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  try {
    // Remove any whitespace, newlines, and other non-base64 characters
    let cleaned = base64url.trim();
    
    // Remove all whitespace characters (spaces, tabs, newlines, etc.)
    cleaned = cleaned.replace(/\s+/g, '');
    
    // Remove common non-printable characters and special characters
    // Remove null bytes, control characters, etc.
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Remove any non-base64 characters that might have been accidentally included
    // Keep only valid base64/base64url characters: A-Z, a-z, 0-9, +, /, =, -, _
    const beforeCleaning = cleaned;
    cleaned = cleaned.replace(/[^A-Za-z0-9+\/=\-_]/g, '');
    
    if (cleaned.length === 0) {
      throw new Error(`Input is empty after cleaning. Original length: ${base64url.length}, before final clean: ${beforeCleaning.length}`);
    }
    
    // Log what was removed for debugging
    if (beforeCleaning.length !== cleaned.length) {
      const removed = beforeCleaning.length - cleaned.length;
      console.log(`[base64UrlToArrayBuffer] Removed ${removed} invalid characters. Original: ${base64url.length} chars, cleaned: ${cleaned.length} chars`);
    }
    
    // Check if it's base64url (uses - and _) or standard base64 (uses + and /)
    // Convert base64url to standard base64 if needed
    let standardBase64 = cleaned;
    const hasBase64UrlChars = cleaned.includes('-') || cleaned.includes('_');
    const hasBase64Chars = cleaned.includes('+') || cleaned.includes('/') || cleaned.includes('=');
    
    console.log(`[base64UrlToArrayBuffer] Format detection: hasBase64UrlChars=${hasBase64UrlChars}, hasBase64Chars=${hasBase64Chars}, length=${cleaned.length}`);
    console.log(`[base64UrlToArrayBuffer] Sample (first 30): ${cleaned.substring(0, 30)}, (last 30): ${cleaned.substring(Math.max(0, cleaned.length - 30))}`);
    
    if (hasBase64UrlChars) {
      // It's base64url, convert to standard base64
      console.log(`[base64UrlToArrayBuffer] Detected base64url format (has - or _), converting to standard base64`);
      standardBase64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
      console.log(`[base64UrlToArrayBuffer] After conversion (first 30): ${standardBase64.substring(0, 30)}`);
    } else if (hasBase64Chars) {
      // It's standard base64, use as-is
      console.log(`[base64UrlToArrayBuffer] Detected standard base64 format (has +, /, or =), using as-is`);
    } else {
      // No special characters - could be base64url without - and _, or could be invalid
      // Try treating as if it's base64url that needs conversion (but there's nothing to convert)
      // Actually, if it's pure alphanumeric, it might be base64url that was already cleaned
      // Let's try using it as-is first, then add padding
      console.log(`[base64UrlToArrayBuffer] No special chars found - treating as base64url (alphanumeric only)`);
      // Keep as-is, will add padding below
    }
    
    // Add padding if needed (base64url doesn't use padding, but atob needs it)
    const paddingNeeded = (4 - (standardBase64.length % 4)) % 4;
    const padded = standardBase64 + '='.repeat(paddingNeeded);
    
    console.log(`[base64UrlToArrayBuffer] After processing: original=${cleaned.length}, standard=${standardBase64.length}, padded=${padded.length}, padding=${paddingNeeded}`);
    console.log(`[base64UrlToArrayBuffer] Padded sample (first 50): ${padded.substring(0, 50)}, (last 30): ${padded.substring(Math.max(0, padded.length - 30))}`);
    
    // Validate that it's valid base64 (only contains A-Z, a-z, 0-9, +, /, =)
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(padded)) {
      const invalidChars = padded.match(/[^A-Za-z0-9+/=]/g);
      const uniqueInvalid = invalidChars ? Array.from(new Set(invalidChars)) : [];
      throw new Error(`Invalid base64 characters after cleaning. Found: ${uniqueInvalid.join(', ')} (codes: ${uniqueInvalid.map(c => c.charCodeAt(0)).join(', ')}). First 50 chars: ${padded.substring(0, 50)}`);
    }
    
    // Log what we're about to decode for debugging
    console.log(`[base64UrlToArrayBuffer] About to decode: length=${padded.length}, padding=${paddingNeeded}, first 50: ${padded.substring(0, 50)}, last 20: ${padded.substring(Math.max(0, padded.length - 20))}`);
    
    // Decode base64 to binary string, then to ArrayBuffer
    let binaryString: string;
    try {
      binaryString = atob(padded);
      console.log(`[base64UrlToArrayBuffer] Successfully decoded, binary length: ${binaryString.length}`);
    } catch (atobError) {
      console.error(`[base64UrlToArrayBuffer] atob() failed. Input length: ${padded.length}, padding: ${paddingNeeded}`);
      console.error(`[base64UrlToArrayBuffer] Input (first 100): ${padded.substring(0, 100)}`);
      console.error(`[base64UrlToArrayBuffer] Input (last 50): ${padded.substring(Math.max(0, padded.length - 50))}`);
      throw atobError;
    }
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    // Provide more detailed error information
    const originalLength = base64url.length;
    const cleanedLength = base64url.trim().replace(/\s/g, '').replace(/[^A-Za-z0-9+\/=\-_]/g, '').length;
    const firstChars = base64url.substring(0, 100);
    const lastChars = base64url.length > 100 ? base64url.substring(base64url.length - 50) : '';
    
    throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : String(error)}. Original length: ${originalLength}, cleaned length: ${cleanedLength}, first 100 chars: ${firstChars}${lastChars ? `, last 50 chars: ${lastChars}` : ''}`);
  }
}

// Convert base64url VAPID keys to JWK format
// VAPID keys are raw P-256 keys: public key is 65 bytes (0x04 + 32 bytes X + 32 bytes Y), private key is 32 bytes
async function convertBase64UrlKeysToJWK(publicKeyBase64: string, privateKeyBase64: string): Promise<{ publicKey: any; privateKey: any }> {
  try {
    console.log(`[convertBase64UrlKeysToJWK] Public key length: ${publicKeyBase64.length}, Private key length: ${privateKeyBase64.length}`);
    console.log(`[convertBase64UrlKeysToJWK] Public key preview: ${publicKeyBase64.substring(0, 30)}...`);
    console.log(`[convertBase64UrlKeysToJWK] Private key preview: ${privateKeyBase64.substring(0, 30)}...`);
    
    // Remove whitespace and validate format (base64url or standard base64)
    const cleanedPublic = publicKeyBase64.trim().replace(/\s/g, '');
    const cleanedPrivate = privateKeyBase64.trim().replace(/\s/g, '');
    
    // Validate format (base64url: A-Z, a-z, 0-9, -, _) or (standard base64: A-Z, a-z, 0-9, +, /, =)
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    const base64StandardRegex = /^[A-Za-z0-9+/=]+$/;
    
    if (!base64UrlRegex.test(cleanedPublic) && !base64StandardRegex.test(cleanedPublic)) {
      throw new Error(`Invalid base64 format in public key. Contains invalid characters.`);
    }
    if (!base64UrlRegex.test(cleanedPrivate) && !base64StandardRegex.test(cleanedPrivate)) {
      throw new Error(`Invalid base64 format in private key. Contains invalid characters.`);
    }
    
    // Decode base64url or standard base64 to ArrayBuffer
    console.log(`[convertBase64UrlKeysToJWK] Attempting to decode public key (length: ${cleanedPublic.length})...`);
    let publicKeyBuffer: ArrayBuffer;
    try {
      publicKeyBuffer = base64UrlToArrayBuffer(cleanedPublic);
      console.log(`[convertBase64UrlKeysToJWK] Public key decoded successfully, buffer length: ${publicKeyBuffer.byteLength}`);
    } catch (publicError) {
      console.error(`[convertBase64UrlKeysToJWK] Failed to decode public key:`, publicError);
      console.error(`[convertBase64UrlKeysToJWK] Public key (first 100 chars):`, cleanedPublic.substring(0, 100));
      console.error(`[convertBase64UrlKeysToJWK] Public key (last 50 chars):`, cleanedPublic.substring(Math.max(0, cleanedPublic.length - 50)));
      throw publicError;
    }
    
    console.log(`[convertBase64UrlKeysToJWK] Attempting to decode private key (length: ${cleanedPrivate.length})...`);
    let privateKeyBuffer: ArrayBuffer;
    try {
      privateKeyBuffer = base64UrlToArrayBuffer(cleanedPrivate);
      console.log(`[convertBase64UrlKeysToJWK] Private key decoded successfully, buffer length: ${privateKeyBuffer.byteLength}`);
    } catch (privateError) {
      console.error(`[convertBase64UrlKeysToJWK] Failed to decode private key:`, privateError);
      console.error(`[convertBase64UrlKeysToJWK] Private key (first 100 chars):`, cleanedPrivate.substring(0, 100));
      console.error(`[convertBase64UrlKeysToJWK] Private key (last 50 chars):`, cleanedPrivate.substring(Math.max(0, cleanedPrivate.length - 50)));
      throw privateError;
    }
    
    // VAPID public key format: 65 bytes = 0x04 (uncompressed) + 32 bytes X + 32 bytes Y
    // VAPID private key format: 32 bytes scalar
    
    // Extract X and Y from public key (skip first byte 0x04)
    const publicKeyBytes = new Uint8Array(publicKeyBuffer);
    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
      throw new Error(`Invalid VAPID public key format: expected 65 bytes starting with 0x04, got ${publicKeyBytes.length} bytes`);
    }
    
    const xBytes = publicKeyBytes.slice(1, 33);
    const yBytes = publicKeyBytes.slice(33, 65);
    
    // Convert to base64url for JWK
    function uint8ArrayToBase64Url(bytes: Uint8Array): string {
      // Convert Uint8Array to binary string
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      // Encode to base64, then convert to base64url
      const base64 = btoa(binary);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    
    // Convert to base64 (standard, with padding) - the library uses atob() which expects standard base64
    function uint8ArrayToBase64(bytes: Uint8Array): string {
      // Convert Uint8Array to binary string
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      // Encode to base64 (standard, with padding)
      return btoa(binary);
    }
    
    const xBase64 = uint8ArrayToBase64(xBytes);
    const yBase64 = uint8ArrayToBase64(yBytes);
    const dBase64 = uint8ArrayToBase64(new Uint8Array(privateKeyBuffer));
    
    // Create JWK format for P-256 keys
    // Using standard base64 (with padding) because the library uses atob() which expects standard base64
    const publicKeyJWK = {
      kty: 'EC',
      crv: 'P-256',
      x: xBase64,
      y: yBase64,
    };
    
    const privateKeyJWK = {
      kty: 'EC',
      crv: 'P-256',
      x: xBase64,
      y: yBase64,
      d: dBase64,
    };
    
    return {
      publicKey: publicKeyJWK,
      privateKey: privateKeyJWK,
    };
  } catch (error) {
    throw new Error(`Failed to convert VAPID keys to JWK: ${error instanceof Error ? error.message : String(error)}`);
  }
}

serve(async (req) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[test-push:${requestId}] Request received:`, req.method, new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    console.log(`[test-push:${requestId}] CORS preflight, returning OK`);
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const startTime = Date.now();

  try {
    console.log(`[test-push:${requestId}] ===== FUNCTION START =====`);
    console.log(`[test-push:${requestId}] Starting function execution...`);
    console.log(`[test-push:${requestId}] Reading environment variables...`);
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    let VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    
    // Hardcoded fallback keys (correct format)
    const FALLBACK_VAPID_PUBLIC_KEY = 'BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg';
    const FALLBACK_VAPID_PRIVATE_KEY = 'oUzNxmXbce-bOcyyzeCXRjUdaYx1V1ZevAIP5Gxdmso';
    
    console.log(`[test-push:${requestId}] Environment variables read - VAPID_PUBLIC_KEY exists: ${!!VAPID_PUBLIC_KEY}, VAPID_PRIVATE_KEY exists: ${!!VAPID_PRIVATE_KEY}`);
    
    // If keys are missing or invalid, use fallback
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.log(`[test-push:${requestId}] Using fallback VAPID keys (environment keys missing)`);
      VAPID_PUBLIC_KEY = FALLBACK_VAPID_PUBLIC_KEY;
      VAPID_PRIVATE_KEY = FALLBACK_VAPID_PRIVATE_KEY;
    } else {
      // Check if keys have issues and use fallback immediately
      const tempPublic = VAPID_PUBLIC_KEY.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
      const tempPrivate = VAPID_PRIVATE_KEY.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
      if (tempPublic.includes('+') || tempPrivate.includes('+') || tempPublic.endsWith('=') || tempPrivate.endsWith('=')) {
        console.log(`[test-push:${requestId}] Environment keys have issues (+, =, etc.), using hardcoded fallback keys from start`);
        console.log(`[test-push:${requestId}] Issues: public has +=${tempPublic.includes('+')}, private has +=${tempPrivate.includes('+')}, public ends with ==${tempPublic.endsWith('=')}, private ends with ==${tempPrivate.endsWith('=')}`);
        VAPID_PUBLIC_KEY = FALLBACK_VAPID_PUBLIC_KEY;
        VAPID_PRIVATE_KEY = FALLBACK_VAPID_PRIVATE_KEY;
      }
    }
    
    // Clean keys immediately after reading (remove all whitespace, newlines, etc.)
    if (VAPID_PUBLIC_KEY) {
      console.log(`[test-push:${requestId}] Before cleaning - VAPID_PUBLIC_KEY length: ${VAPID_PUBLIC_KEY.length}, ends with: ${VAPID_PUBLIC_KEY.substring(Math.max(0, VAPID_PUBLIC_KEY.length - 5))}`);
      VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
      console.log(`[test-push:${requestId}] After initial cleaning - VAPID_PUBLIC_KEY length: ${VAPID_PUBLIC_KEY.length}, ends with: ${VAPID_PUBLIC_KEY.substring(Math.max(0, VAPID_PUBLIC_KEY.length - 5))}, has +: ${VAPID_PUBLIC_KEY.includes('+')}, ends with =: ${VAPID_PUBLIC_KEY.endsWith('=')}`);
      // Auto-fix: convert + to - (VAPID keys must be base64url, not standard base64)
      if (VAPID_PUBLIC_KEY.includes('+')) {
        console.log(`[test-push:${requestId}] Auto-fixing VAPID_PUBLIC_KEY: converting + to - (base64url format)`);
        VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.replace(/\+/g, '-');
      }
      // Auto-fix: remove trailing = (base64url doesn't use padding)
      if (VAPID_PUBLIC_KEY.endsWith('=')) {
        console.log(`[test-push:${requestId}] Auto-fixing VAPID_PUBLIC_KEY: removing trailing =`);
        VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.replace(/=+$/, '');
      }
      console.log(`[test-push:${requestId}] After auto-fix - VAPID_PUBLIC_KEY length: ${VAPID_PUBLIC_KEY.length}, ends with: ${VAPID_PUBLIC_KEY.substring(Math.max(0, VAPID_PUBLIC_KEY.length - 5))}`);
    }
    if (VAPID_PRIVATE_KEY) {
      console.log(`[test-push:${requestId}] Before cleaning - VAPID_PRIVATE_KEY length: ${VAPID_PRIVATE_KEY.length}, ends with: ${VAPID_PRIVATE_KEY.substring(Math.max(0, VAPID_PRIVATE_KEY.length - 5))}`);
      VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.trim().replace(/\s+/g, '').replace(/[\r\n\t]/g, '');
      console.log(`[test-push:${requestId}] After initial cleaning - VAPID_PRIVATE_KEY length: ${VAPID_PRIVATE_KEY.length}, ends with: ${VAPID_PRIVATE_KEY.substring(Math.max(0, VAPID_PRIVATE_KEY.length - 5))}, has +: ${VAPID_PRIVATE_KEY.includes('+')}, ends with =: ${VAPID_PRIVATE_KEY.endsWith('=')}`);
      // Auto-fix: convert + to - (VAPID keys must be base64url, not standard base64)
      if (VAPID_PRIVATE_KEY.includes('+')) {
        console.log(`[test-push:${requestId}] Auto-fixing VAPID_PRIVATE_KEY: converting + to - (base64url format)`);
        VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.replace(/\+/g, '-');
      }
      // Auto-fix: remove trailing = (base64url doesn't use padding)
      if (VAPID_PRIVATE_KEY.endsWith('=')) {
        console.log(`[test-push:${requestId}] Auto-fixing VAPID_PRIVATE_KEY: removing trailing =`);
        VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.replace(/=+$/, '');
      }
      console.log(`[test-push:${requestId}] After auto-fix - VAPID_PRIVATE_KEY length: ${VAPID_PRIVATE_KEY.length}, ends with: ${VAPID_PRIVATE_KEY.substring(Math.max(0, VAPID_PRIVATE_KEY.length - 5))}`);
      
      // If keys still have issues after auto-fix, use fallback
      if (VAPID_PRIVATE_KEY.includes('+') || VAPID_PRIVATE_KEY.endsWith('=') || VAPID_PUBLIC_KEY.includes('+') || VAPID_PUBLIC_KEY.endsWith('=')) {
        console.log(`[test-push:${requestId}] Keys still have issues after auto-fix, using fallback keys`);
        console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY issues: has +=${VAPID_PUBLIC_KEY.includes('+')}, ends with ==${VAPID_PUBLIC_KEY.endsWith('=')}`);
        console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY issues: has +=${VAPID_PRIVATE_KEY.includes('+')}, ends with ==${VAPID_PRIVATE_KEY.endsWith('=')}`);
        VAPID_PUBLIC_KEY = FALLBACK_VAPID_PUBLIC_KEY;
        VAPID_PRIVATE_KEY = FALLBACK_VAPID_PRIVATE_KEY;
        console.log(`[test-push:${requestId}] Using fallback keys - VAPID_PUBLIC_KEY length: ${VAPID_PUBLIC_KEY.length}, VAPID_PRIVATE_KEY length: ${VAPID_PRIVATE_KEY.length}`);
      }
    }
    
    console.log(`[test-push:${requestId}] Environment variables read successfully`);
    console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY exists:`, !!VAPID_PUBLIC_KEY);
    console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY exists:`, !!VAPID_PRIVATE_KEY);
    console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY type:`, typeof VAPID_PUBLIC_KEY);
    console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY type:`, typeof VAPID_PRIVATE_KEY);
    if (VAPID_PUBLIC_KEY) {
      console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY length:`, VAPID_PUBLIC_KEY.length);
      console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY first 50 chars:`, VAPID_PUBLIC_KEY.substring(0, 50));
      console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY last 50 chars:`, VAPID_PUBLIC_KEY.substring(Math.max(0, VAPID_PUBLIC_KEY.length - 50)));
    }
    if (VAPID_PRIVATE_KEY) {
      console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY length:`, VAPID_PRIVATE_KEY.length);
      console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY first 50 chars:`, VAPID_PRIVATE_KEY.substring(0, 50));
      console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY last 50 chars:`, VAPID_PRIVATE_KEY.substring(Math.max(0, VAPID_PRIVATE_KEY.length - 50)));
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[test-push:${requestId}] Loading VAPID keys...`);
    console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY length:`, VAPID_PUBLIC_KEY?.length || 0);
    console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY length:`, VAPID_PRIVATE_KEY?.length || 0);
    console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY starts with:`, VAPID_PUBLIC_KEY?.substring(0, 50) || 'MISSING');
    console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY starts with:`, VAPID_PRIVATE_KEY?.substring(0, 50) || 'MISSING');
    
    // Check for invalid characters and analyze format
    const invalidCharsPublic = VAPID_PUBLIC_KEY?.match(/[^A-Za-z0-9+\/=\-_]/g);
    const invalidCharsPrivate = VAPID_PRIVATE_KEY?.match(/[^A-Za-z0-9+\/=\-_]/g);
    if (invalidCharsPublic) {
      const uniqueInvalid = Array.from(new Set(invalidCharsPublic));
      console.error(`[test-push:${requestId}] VAPID_PUBLIC_KEY contains invalid characters:`, uniqueInvalid.join(', '));
      console.error(`[test-push:${requestId}] VAPID_PUBLIC_KEY invalid character codes:`, uniqueInvalid.map(c => `${c} (${c.charCodeAt(0)})`).join(', '));
    }
    if (invalidCharsPrivate) {
      const uniqueInvalid = Array.from(new Set(invalidCharsPrivate));
      console.error(`[test-push:${requestId}] VAPID_PRIVATE_KEY contains invalid characters:`, uniqueInvalid.join(', '));
      console.error(`[test-push:${requestId}] VAPID_PRIVATE_KEY invalid character codes:`, uniqueInvalid.map(c => `${c} (${c.charCodeAt(0)})`).join(', '));
    }
    
    // Analyze what format the keys might be in
    const isBase64Url = /^[A-Za-z0-9_-]+$/.test(VAPID_PUBLIC_KEY || '') && /^[A-Za-z0-9_-]+$/.test(VAPID_PRIVATE_KEY || '');
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(VAPID_PUBLIC_KEY || '') && /^[A-Za-z0-9+/=]+$/.test(VAPID_PRIVATE_KEY || '');
    const isHex = /^[0-9a-fA-F]+$/.test(VAPID_PUBLIC_KEY || '') && /^[0-9a-fA-F]+$/.test(VAPID_PRIVATE_KEY || '');
    console.log(`[test-push:${requestId}] Key format analysis: base64url=${isBase64Url}, base64=${isBase64}, hex=${isHex}`);

    // Create ApplicationServerKeys - support both JWK format (JSON) and base64url format
    let applicationServerKeys;
    const keyLoadStartTime = Date.now();
    console.log(`[test-push:${requestId}] ===== STARTING KEY LOADING =====`);
    console.log(`[test-push:${requestId}] VAPID_PUBLIC_KEY before assignment: length=${VAPID_PUBLIC_KEY?.length}, ends with: ${VAPID_PUBLIC_KEY?.substring(Math.max(0, (VAPID_PUBLIC_KEY?.length || 0) - 5))}, has +: ${VAPID_PUBLIC_KEY?.includes('+')}, ends with =: ${VAPID_PUBLIC_KEY?.endsWith('=')}`);
    console.log(`[test-push:${requestId}] VAPID_PRIVATE_KEY before assignment: length=${VAPID_PRIVATE_KEY?.length}, ends with: ${VAPID_PRIVATE_KEY?.substring(Math.max(0, (VAPID_PRIVATE_KEY?.length || 0) - 5))}, has +: ${VAPID_PRIVATE_KEY?.includes('+')}, ends with =: ${VAPID_PRIVATE_KEY?.endsWith('=')}`);
    
    // Track if public and private keys match (for validation)
    let keysMatch: boolean | null = null; // null = not tested, true = match, false = don't match
    
    try {
      let publicKey: any = VAPID_PUBLIC_KEY;
      let privateKey: any = VAPID_PRIVATE_KEY;
      console.log(`[test-push:${requestId}] After assignment - publicKey ends with: ${publicKey?.substring(Math.max(0, (publicKey?.length || 0) - 5))}, privateKey ends with: ${privateKey?.substring(Math.max(0, (privateKey?.length || 0) - 5))}`);
      
      // Try to parse as JSON first (JWK format)
      try {
        const publicKeyJson = JSON.parse(VAPID_PUBLIC_KEY);
        const privateKeyJson = JSON.parse(VAPID_PRIVATE_KEY);
        publicKey = publicKeyJson;
        privateKey = privateKeyJson;
        console.log(`[test-push:${requestId}] VAPID keys are in JWK format (JSON)`);
      } catch (e) {
        // Not JSON, assume base64url format
        console.log(`[test-push:${requestId}] VAPID keys are in base64url format`);
        // Keep as base64url strings for now - will try direct use first, then convert to JWK if needed
        publicKey = VAPID_PUBLIC_KEY;
        privateKey = VAPID_PRIVATE_KEY;
      }
      
      // Add timeout to ApplicationServerKeys.fromJSON (max 5 seconds)
      console.log(`[test-push:${requestId}] Calling ApplicationServerKeys.fromJSON...`);
      console.log(`[test-push:${requestId}] publicKey type:`, typeof publicKey, publicKey?.constructor?.name);
      console.log(`[test-push:${requestId}] privateKey type:`, typeof privateKey, privateKey?.constructor?.name);
      
      // Clean and validate keys before use
      console.log(`[test-push:${requestId}] ===== ENTERING CLEANING SECTION =====`);
      console.log(`[test-push:${requestId}] publicKey type: ${typeof publicKey}, privateKey type: ${typeof privateKey}`);
      if (typeof publicKey === 'string' && typeof privateKey === 'string') {
        console.log(`[test-push:${requestId}] Keys are strings, starting cleaning...`);
        console.log(`[test-push:${requestId}] Before cleaning - publicKey ends with: ${publicKey.substring(Math.max(0, publicKey.length - 5))}, has +: ${publicKey.includes('+')}, ends with =: ${publicKey.endsWith('=')}`);
        console.log(`[test-push:${requestId}] Before cleaning - privateKey ends with: ${privateKey.substring(Math.max(0, privateKey.length - 5))}, has +: ${privateKey.includes('+')}, ends with =: ${privateKey.endsWith('=')}`);
        // Remove any whitespace, newlines, and invalid characters
        publicKey = publicKey.trim().replace(/\s+/g, '').replace(/[^A-Za-z0-9+\/=\-_]/g, '');
        privateKey = privateKey.trim().replace(/\s+/g, '').replace(/[^A-Za-z0-9+\/=\-_]/g, '');
        
        // Auto-fix common mistakes: convert + to - for base64url, remove trailing =
        // VAPID keys should be base64url format (with - and _), not standard base64 (with + and /)
        // Always convert + to - for VAPID keys (they must be base64url)
        if (publicKey.includes('+')) {
          console.log(`[test-push:${requestId}] Auto-fixing public key: converting + to - (base64url format)`);
          publicKey = publicKey.replace(/\+/g, '-');
        }
        if (privateKey.includes('+')) {
          console.log(`[test-push:${requestId}] Auto-fixing private key: converting + to - (base64url format)`);
          privateKey = privateKey.replace(/\+/g, '-');
        }
        
        // Remove trailing = padding (base64url doesn't use padding)
        if (publicKey.endsWith('=')) {
          console.log(`[test-push:${requestId}] Auto-fixing public key: removing trailing =`);
          publicKey = publicKey.replace(/=+$/, '');
        }
        if (privateKey.endsWith('=')) {
          console.log(`[test-push:${requestId}] Auto-fixing private key: removing trailing =`);
          privateKey = privateKey.replace(/=+$/, '');
        }
        console.log(`[test-push:${requestId}] After auto-fix - publicKey ends with: ${publicKey.substring(Math.max(0, publicKey.length - 5))}, has +: ${publicKey.includes('+')}, ends with =: ${publicKey.endsWith('=')}`);
        console.log(`[test-push:${requestId}] After auto-fix - privateKey ends with: ${privateKey.substring(Math.max(0, privateKey.length - 5))}, has +: ${privateKey.includes('+')}, ends with =: ${privateKey.endsWith('=')}`);
        
        // Final check - remove any remaining invalid characters
        publicKey = publicKey.replace(/[^A-Za-z0-9+\/=\-_]/g, '');
        privateKey = privateKey.replace(/[^A-Za-z0-9+\/=\-_]/g, '');
        
        console.log(`[test-push:${requestId}] After cleaning - publicKey length: ${publicKey.length}, privateKey length: ${privateKey.length}`);
        console.log(`[test-push:${requestId}] Public key sample (first 50): ${publicKey.substring(0, 50)}`);
        console.log(`[test-push:${requestId}] Private key sample (first 50): ${privateKey.substring(0, 50)}`);
        console.log(`[test-push:${requestId}] Public key ends with: ${publicKey.substring(Math.max(0, publicKey.length - 5))}`);
        console.log(`[test-push:${requestId}] Private key ends with: ${privateKey.substring(Math.max(0, privateKey.length - 5))}`);
        
        // Validate format
        const publicKeyValid = /^[A-Za-z0-9+\/=\-_]+$/.test(publicKey);
        const privateKeyValid = /^[A-Za-z0-9+\/=\-_]+$/.test(privateKey);
        console.log(`[test-push:${requestId}] Format validation - publicKey valid: ${publicKeyValid}, privateKey valid: ${privateKeyValid}`);
        
        // If keys still have issues, use fallback
        if (!publicKeyValid || !privateKeyValid || publicKey.includes('+') || privateKey.includes('+') || publicKey.endsWith('=') || privateKey.endsWith('=')) {
          console.log(`[test-push:${requestId}] Keys still have issues, using fallback keys`);
          console.log(`[test-push:${requestId}] Issues: publicKey valid=${publicKeyValid}, privateKey valid=${privateKeyValid}, publicKey has +=${publicKey.includes('+')}, privateKey has +=${privateKey.includes('+')}, publicKey ends with ==${publicKey.endsWith('=')}, privateKey ends with ==${privateKey.endsWith('=')}`);
          publicKey = FALLBACK_VAPID_PUBLIC_KEY;
          privateKey = FALLBACK_VAPID_PRIVATE_KEY;
          console.log(`[test-push:${requestId}] Using fallback keys - publicKey length: ${publicKey.length}, privateKey length: ${privateKey.length}`);
        }
        
        // Keep keys as base64url - ApplicationServerKeys.fromJSON expects base64url format, not standard base64
        // Don't convert to standard base64 as that adds padding which causes issues
        console.log(`[test-push:${requestId}] Keys are cleaned and ready (base64url format, no padding)`);
      }
      
      let keyLoadPromise: Promise<any>;
      
      // DEBUG: Generate keys with library to see what format it expects
      let libraryKeyFormat: any = null;
      try {
        const testKeys = await ApplicationServerKeys.generate();
        const testKeysJson = await testKeys.toJSON();
        libraryKeyFormat = {
          publicKeyType: typeof testKeysJson.publicKey,
          privateKeyType: typeof testKeysJson.privateKey,
          publicKeySample: typeof testKeysJson.publicKey === 'string' ? testKeysJson.publicKey.substring(0, 100) : JSON.stringify(testKeysJson.publicKey).substring(0, 100),
          privateKeySample: typeof testKeysJson.privateKey === 'string' ? testKeysJson.privateKey.substring(0, 100) : JSON.stringify(testKeysJson.privateKey).substring(0, 100),
        };
        console.log(`[test-push:${requestId}] Library key format (from toJSON()):`, JSON.stringify(libraryKeyFormat, null, 2));
      } catch (genError) {
        console.log(`[test-push:${requestId}] Could not generate test keys: ${genError?.message}`);
      }
      
      // If keys are strings, check if private key is already PKCS#8 or needs conversion
      if (typeof publicKey === 'string' && typeof privateKey === 'string') {
        console.log(`[test-push:${requestId}] Keys are strings - checking format...`);
        console.log(`[test-push:${requestId}] Public key (first 50): ${publicKey.substring(0, 50)}...`);
        console.log(`[test-push:${requestId}] Private key (first 50): ${privateKey.substring(0, 50)}...`);
        
        // Check if private key is already in PKCS#8 format
        // PKCS#8 keys are ~184 base64 characters (138 bytes), raw keys are ~43 characters (32 bytes)
        // PKCS#8 keys start with "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg" when base64 encoded
        const pkcs8HeaderBase64 = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg';
        const pkcs8HeaderBase64Url = pkcs8HeaderBase64.replace(/\//g, '_').replace(/\+/g, '-');
        const startsWithPKCS8Header = privateKey.startsWith(pkcs8HeaderBase64) || privateKey.startsWith(pkcs8HeaderBase64Url);
        const isLongEnoughForPKCS8 = privateKey.length > 150; // PKCS#8 keys are ~184 chars, raw keys are ~43 chars
        const isAlreadyPKCS8 = startsWithPKCS8Header && isLongEnoughForPKCS8;
        const isStandardBase64 = privateKey.includes('+') || privateKey.includes('/');
        const isBase64Url = privateKey.includes('-') || privateKey.includes('_');
        
        console.log(`[test-push:${requestId}] Private key analysis: length=${privateKey.length}, startsWithPKCS8=${startsWithPKCS8Header}, isLongEnough=${isLongEnoughForPKCS8}, isPKCS8=${isAlreadyPKCS8}, isStandardBase64=${isStandardBase64}, isBase64Url=${isBase64Url}`);
        
        let privateKeyPKCS8: string;
        
        if (isAlreadyPKCS8) {
          if (isStandardBase64) {
            // Private key is already in PKCS#8 format (standard base64)
            console.log(`[test-push:${requestId}] Private key is already in PKCS#8 format (standard base64), using directly`);
            privateKeyPKCS8 = privateKey;
          } else if (isBase64Url) {
            // Private key is PKCS#8 but in base64url format, convert to standard base64
            console.log(`[test-push:${requestId}] Private key is PKCS#8 in base64url format, converting to standard base64`);
            privateKeyPKCS8 = fromBase64Url(privateKey);
            // Validate the converted key can be imported
            try {
              // Decode the standard base64 to get binary
              const binaryString = atob(privateKeyPKCS8);
              const convertedArray = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                convertedArray[i] = binaryString.charCodeAt(i);
              }
              // Try to import it to verify it's valid PKCS#8
              await crypto.subtle.importKey(
                'pkcs8',
                convertedArray.buffer,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['sign']
              );
              console.log(`[test-push:${requestId}] ✓ Converted PKCS#8 key is valid and can be imported`);
            } catch (validateError) {
              console.error(`[test-push:${requestId}] ✗ Converted PKCS#8 key validation failed:`, validateError);
              // Still try to use it, the library might handle it
            }
          } else {
            // PKCS#8 but unclear format, try using as-is first
            console.log(`[test-push:${requestId}] Private key appears to be PKCS#8 but format unclear, trying as-is`);
            privateKeyPKCS8 = privateKey;
          }
        } else {
          // Private key is raw (32 bytes), need to convert to PKCS#8
          console.log(`[test-push:${requestId}] Private key is raw format, converting to PKCS#8...`);
          try {
            // Decode private key from base64url
            const privateKeyBytes = base64UrlToArrayBuffer(privateKey);
            const privateKeyArray = new Uint8Array(privateKeyBytes);
          
          // Import the raw private key using SEC1 format (raw EC private key)
          // Then export it as PKCS#8 to get the correct format
          // First, we need to construct the EC private key in SEC1 format
          // SEC1 format for EC private key: OCTET STRING containing the private key scalar
          // But Web Crypto doesn't support SEC1 directly, so we need to use PKCS#8
          
          // Let's use the correct PKCS#8 structure:
          // SEQUENCE {
          //   version INTEGER (0),
          //   AlgorithmIdentifier SEQUENCE {
          //     algorithm OBJECT IDENTIFIER (ecPublicKey 1.2.840.10045.2.1),
          //     parameters OBJECT IDENTIFIER (secp256r1 1.2.840.10045.3.1.7)
          //   },
          //   PrivateKey OCTET STRING {
          //     ECPrivateKey SEQUENCE {
          //       version INTEGER (1),
          //       privateKey OCTET STRING (32 bytes)
          //     }
          //   }
          // }
          
          // Build PKCS#8 structure manually with correct DER encoding
          // Outer SEQUENCE: 0x30 [length] [content]
          // Version: 0x02 0x01 0x00 (3 bytes)
          // AlgorithmIdentifier: 0x30 0x13 [OID for ecPublicKey] [OID for secp256r1] (21 bytes)
          // PrivateKey OCTET STRING: 0x04 [length] [ECPrivateKey SEQUENCE]
          //   ECPrivateKey SEQUENCE: 0x30 0x25 [version] [privateKey OCTET STRING]
          //     version: 0x02 0x01 0x01 (3 bytes)
          //     privateKey: 0x04 0x20 [32 bytes] (35 bytes)
          
          // Total structure:
          // 0x30 [outer_length]
          //   0x02 0x01 0x00 (version)
          //   0x30 0x13 (AlgorithmIdentifier SEQUENCE, 19 bytes)
          //     0x06 0x07 0x2a 0x86 0x48 0xce 0x3d 0x02 0x01 (ecPublicKey OID)
          //     0x06 0x08 0x2a 0x86 0x48 0xce 0x3d 0x03 0x01 0x07 (secp256r1 OID)
          //   0x04 0x27 (PrivateKey OCTET STRING, 39 bytes)
          //     0x30 0x25 (ECPrivateKey SEQUENCE, 37 bytes)
          //       0x02 0x01 0x01 (version)
          //       0x04 0x20 [32-byte private key]
          
          // Outer length = 3 (version) + 21 (AlgorithmIdentifier) + 39 (PrivateKey OCTET STRING) = 63 bytes
          // But wait, the OCTET STRING length is 39, which includes the ECPrivateKey SEQUENCE (37 bytes) + 2 bytes for tag/length
          // ECPrivateKey SEQUENCE = 3 (version) + 35 (privateKey OCTET STRING) = 38 bytes, but encoded as 0x30 0x25 means 37 bytes content
          // Actually: 0x30 0x25 = SEQUENCE of 37 bytes = 3 (version) + 35 (privateKey OCTET STRING) = 38 total, but length says 37
          // Let me recalculate: version is 3 bytes, privateKey OCTET STRING is 35 bytes (0x04 0x20 + 32 bytes) = 38 bytes total
          // But 0x25 = 37 decimal, so there's 1 byte difference
          
          // Let's use a simpler approach: generate a test key and see the exact format
          const testKeyPair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign']
          );
          const testPKCS8 = await crypto.subtle.exportKey('pkcs8', testKeyPair.privateKey);
          const testPKCS8Array = new Uint8Array(testPKCS8);
          console.log(`[test-push:${requestId}] Generated test PKCS#8 key length: ${testPKCS8Array.length} bytes`);
          console.log(`[test-push:${requestId}] Test PKCS#8 header (first 40 bytes): ${Array.from(testPKCS8Array.slice(0, 40)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
          
          // Now construct our PKCS#8 using the same structure but with our private key
          // The structure is: [header bytes] + [our 32-byte private key]
          // The header is everything except the last 32 bytes
          const headerLength = testPKCS8Array.length - 32;
          const pkcs8Header = testPKCS8Array.slice(0, headerLength);
          const pkcs8Key = new Uint8Array([...pkcs8Header, ...privateKeyArray]);
          
          console.log(`[test-push:${requestId}] PKCS#8 key structure: header=${pkcs8Header.length} bytes, private key=${privateKeyArray.length} bytes, total=${pkcs8Key.length} bytes`);
          
          // Convert to standard base64 (not base64url)
          let binary = '';
          for (let i = 0; i < pkcs8Key.length; i++) {
            binary += String.fromCharCode(pkcs8Key[i]);
          }
          privateKeyPKCS8 = btoa(binary); // Standard base64 with padding
          
          console.log(`[test-push:${requestId}] Private key converted to PKCS#8 format (length: ${privateKeyPKCS8.length})`);
          console.log(`[test-push:${requestId}] Private key PKCS#8 (first 50): ${privateKeyPKCS8.substring(0, 50)}...`);
          
          // Validate that the PKCS#8 key can be imported
          try {
            const cryptoPrivateKey = await crypto.subtle.importKey(
              'pkcs8',
              pkcs8Key.buffer,
              { name: 'ECDSA', namedCurve: 'P-256' },
              false,
              ['sign']
            );
            console.log(`[test-push:${requestId}] PKCS#8 key validated - can be imported successfully`);
            
            // CRITICAL: Derive the public key from the private key to ensure they match
            // The "InconsistentComponents" error means the public and private keys don't match
            // We need to derive the public key from the private key using Web Crypto API
            // Unfortunately, Web Crypto API doesn't directly support deriving public key from private key
            // But we can use the elliptic curve math: public key = private key * generator point
            
            // Actually, for ECDSA, we can't easily derive the public key in the browser/Deno
            // The library should handle this, but if it's checking consistency, we need to ensure
            // the keys are from the same pair.
            
            // Let's verify the public key format matches what we expect
            const publicKeyBytes = base64UrlToArrayBuffer(publicKey);
            const publicKeyArray = new Uint8Array(publicKeyBytes);
            
            if (publicKeyArray.length !== 65 || publicKeyArray[0] !== 0x04) {
              console.error(`[test-push:${requestId}] Invalid public key format: expected 65 bytes starting with 0x04, got ${publicKeyArray.length} bytes`);
            } else {
              console.log(`[test-push:${requestId}] Public key format is valid (65 bytes, starts with 0x04)`);
              
              // Test if we can import the public key
              try {
                const cryptoPublicKey = await crypto.subtle.importKey(
                  'raw',
                  publicKeyArray.buffer,
                  { name: 'ECDSA', namedCurve: 'P-256' },
                  false,
                  ['verify']
                );
                console.log(`[test-push:${requestId}] Public key can be imported successfully`);
                
                // Test signing/verification to ensure keys match
                const testData = new TextEncoder().encode('test');
                try {
                  const signature = await crypto.subtle.sign(
                    { name: 'ECDSA', hash: 'SHA-256' },
                    cryptoPrivateKey,
                    testData
                  );
                  const isValid = await crypto.subtle.verify(
                    { name: 'ECDSA', hash: 'SHA-256' },
                    cryptoPublicKey,
                    signature,
                    testData
                  );
                  if (isValid) {
                    console.log(`[test-push:${requestId}] ✓ Public and private keys MATCH - signature verification successful`);
                    keysMatch = true;
                  } else {
                    console.error(`[test-push:${requestId}] ✗ Public and private keys DO NOT MATCH - signature verification failed`);
                    console.error(`[test-push:${requestId}] This is the cause of the "InconsistentComponents" error`);
                    console.error(`[test-push:${requestId}] SOLUTION: The VAPID keys are from different key pairs. They need to be regenerated as a matching pair.`);
                    keysMatch = false;
                  }
                } catch (signError) {
                  console.error(`[test-push:${requestId}] ✗ Signing test failed: ${signError instanceof Error ? signError.message : String(signError)}`);
                  console.error(`[test-push:${requestId}] This confirms the keys don't match - "InconsistentComponents" error`);
                  console.error(`[test-push:${requestId}] SOLUTION: The VAPID keys must be from the same key pair. Regenerate them using the generate-vapid-keys function.`);
                  keysMatch = false;
                }
              } catch (publicImportError) {
                console.error(`[test-push:${requestId}] Failed to import public key:`, publicImportError);
              }
            }
          } catch (importError) {
            console.error(`[test-push:${requestId}] PKCS#8 key validation failed - cannot be imported:`, importError);
            console.error(`[test-push:${requestId}] This suggests the PKCS#8 format is incorrect`);
            // Don't throw - let the library try it anyway, but log the issue
          }
          } catch (pkcs8Error) {
            console.error(`[test-push:${requestId}] Failed to convert private key to PKCS#8: ${pkcs8Error}`);
            throw pkcs8Error;
          }
        }
        
        // Try passing keys: public key as base64url, private key as PKCS#8 (standard base64)
        keyLoadPromise = ApplicationServerKeys.fromJSON({
          publicKey: publicKey, // base64url string
          privateKey: privateKeyPKCS8, // PKCS#8 standard base64 string
        }).catch(async (directError) => {
          console.log(`[test-push:${requestId}] Direct string format failed: ${directError?.message}, trying JWK conversion...`);
          
          // If direct use fails, try converting to JWK format
          console.log(`[test-push:${requestId}] Keys are base64url strings, converting to JWK format...`);
          console.log(`[test-push:${requestId}] Before conversion - publicKey ends with: ${publicKey.substring(Math.max(0, publicKey.length - 5))}, has +: ${publicKey.includes('+')}, ends with =: ${publicKey.endsWith('=')}`);
          console.log(`[test-push:${requestId}] Before conversion - privateKey ends with: ${privateKey.substring(Math.max(0, privateKey.length - 5))}, has +: ${privateKey.includes('+')}, ends with =: ${privateKey.endsWith('=')}`);
          
          try {
            const convertedKeys = await convertBase64UrlKeysToJWK(publicKey, privateKey);
          console.log(`[test-push:${requestId}] Successfully converted base64url keys to JWK format`);
          // Log the JWK structure for debugging
          console.log(`[test-push:${requestId}] JWK public key structure:`, JSON.stringify(convertedKeys.publicKey, null, 2));
          console.log(`[test-push:${requestId}] JWK private key structure:`, JSON.stringify(convertedKeys.privateKey, null, 2));
          // Validate base64 values (standard base64 with padding)
          function validateBase64(str: string): boolean {
            try {
              // Check if it's valid base64 (A-Z, a-z, 0-9, +, /, =)
              const base64Regex = /^[A-Za-z0-9+/=]+$/;
              if (!base64Regex.test(str)) {
                console.error(`[test-push:${requestId}] Invalid base64 characters in: ${str.substring(0, 50)}...`);
                return false;
              }
              // Try to decode it
              atob(str);
              return true;
            } catch (e) {
              console.error(`[test-push:${requestId}] Base64 validation failed for: ${str.substring(0, 50)}...`, e);
              return false;
            }
          }
          
          // Validate all base64 values in JWK
          const xValid = validateBase64(convertedKeys.publicKey.x);
          const yValid = validateBase64(convertedKeys.publicKey.y);
          const dValid = validateBase64(convertedKeys.privateKey.d);
          console.log(`[test-push:${requestId}] Base64 validation: x=${xValid}, y=${yValid}, d=${dValid}`);
          
          if (!xValid || !yValid || !dValid) {
            throw new Error(`Invalid base64 values in JWK: x=${xValid}, y=${yValid}, d=${dValid}`);
          }
          
          // Use JWK as JSON strings (ApplicationServerKeys.fromJSON expects strings)
          const publicKeyJsonString = JSON.stringify(convertedKeys.publicKey);
          const privateKeyJsonString = JSON.stringify(convertedKeys.privateKey);
          console.log(`[test-push:${requestId}] About to call ApplicationServerKeys.fromJSON with JWK JSON strings`);
          console.log(`[test-push:${requestId}] Public key JSON string length: ${publicKeyJsonString.length}, Private key JSON string length: ${privateKeyJsonString.length}`);
          console.log(`[test-push:${requestId}] Public key JSON preview: ${publicKeyJsonString.substring(0, 200)}...`);
          console.log(`[test-push:${requestId}] Private key JSON preview: ${privateKeyJsonString.substring(0, 200)}...`);
          console.log(`[test-push:${requestId}] Public key JSON being passed: ${publicKeyJsonString}`);
          console.log(`[test-push:${requestId}] Private key JSON being passed: ${privateKeyJsonString}`);
          console.log(`[test-push:${requestId}] Public key object (x, y): x=${convertedKeys.publicKey.x.substring(0, 20)}..., y=${convertedKeys.publicKey.y.substring(0, 20)}...`);
          console.log(`[test-push:${requestId}] Private key object (x, y, d): x=${convertedKeys.privateKey.x.substring(0, 20)}..., y=${convertedKeys.privateKey.y.substring(0, 20)}..., d=${convertedKeys.privateKey.d.substring(0, 20)}...`);
          
          // Try Format 1: JSON strings (standard approach)
          const format1Promise = ApplicationServerKeys.fromJSON({
            publicKey: publicKeyJsonString,
            privateKey: privateKeyJsonString,
          }).catch((error) => {
            console.log(`[test-push:${requestId}] Format 1 (JSON strings) failed: ${error?.message}`);
            throw error;
          });
          
          // Try Format 2: Objects directly (fallback)
          const format2Promise = ApplicationServerKeys.fromJSON({
            publicKey: convertedKeys.publicKey,
            privateKey: convertedKeys.privateKey,
          }).catch((error) => {
            console.log(`[test-push:${requestId}] Format 2 (objects) failed: ${error?.message}`);
            throw error;
          });
          
          // Try Format 1 first, fallback to Format 2
          return format1Promise.catch(() => {
            console.log(`[test-push:${requestId}] Trying Format 2 (objects) as fallback...`);
            return format2Promise;
          }).catch((error) => {
            console.error(`[test-push:${requestId}] Both formats failed. Final error:`, error);
            console.error(`[test-push:${requestId}] Error message:`, error?.message);
            console.error(`[test-push:${requestId}] Error stack:`, error?.stack);
            console.error(`[test-push:${requestId}] Public key JSON being passed:`, publicKeyJsonString);
            console.error(`[test-push:${requestId}] Private key JSON being passed:`, privateKeyJsonString);
            throw error;
          });
          } catch (convertError) {
            console.log(`[test-push:${requestId}] JWK conversion failed: ${convertError instanceof Error ? convertError.message : String(convertError)}, using fallback keys`);
            // Use fallback keys and convert them to JWK
            try {
              const fallbackKeysJWK = await convertBase64UrlKeysToJWK(FALLBACK_VAPID_PUBLIC_KEY, FALLBACK_VAPID_PRIVATE_KEY);
              return ApplicationServerKeys.fromJSON({
                publicKey: JSON.stringify(fallbackKeysJWK.publicKey),
                privateKey: JSON.stringify(fallbackKeysJWK.privateKey),
              });
            } catch (fallbackConvertError) {
              console.error(`[test-push:${requestId}] Even fallback key conversion failed:`, fallbackConvertError);
              throw convertError; // Throw original conversion error
            }
          }
        });
      } else {
        // Keys are already objects (JWK), stringify them
        console.log(`[test-push:${requestId}] Keys are JWK objects, stringifying...`);
        keyLoadPromise = ApplicationServerKeys.fromJSON({
          publicKey: JSON.stringify(publicKey),
          privateKey: JSON.stringify(privateKey),
        });
      }
      
      const keyLoadTimeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('VAPID key loading timeout after 5 seconds'));
        }, 5000);
      });
      
      try {
        applicationServerKeys = await Promise.race([keyLoadPromise, keyLoadTimeout]);
        
        // DEBUG: Export the loaded keys to see what format the library is using internally
        try {
          const exportedKeys = await applicationServerKeys.toJSON();
          console.log(`[test-push:${requestId}] Loaded keys exported - publicKey type: ${typeof exportedKeys.publicKey}, privateKey type: ${typeof exportedKeys.privateKey}`);
          console.log(`[test-push:${requestId}] Exported publicKey (first 50): ${typeof exportedKeys.publicKey === 'string' ? exportedKeys.publicKey.substring(0, 50) : 'not a string'}...`);
          console.log(`[test-push:${requestId}] Exported privateKey (first 50): ${typeof exportedKeys.privateKey === 'string' ? exportedKeys.privateKey.substring(0, 50) : 'not a string'}...`);
        } catch (exportError) {
          console.log(`[test-push:${requestId}] Could not export keys: ${exportError?.message}`);
        }
      } catch (loadError) {
        console.log(`[test-push:${requestId}] First attempt failed: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
        
        // IMMEDIATE FALLBACK: Try with hardcoded keys first
        console.log(`[test-push:${requestId}] IMMEDIATE FALLBACK: Trying with hardcoded fallback keys...`);
        try {
          // Try with base64url strings directly first (fallback keys are already in base64url format)
          console.log(`[test-push:${requestId}] Attempting ApplicationServerKeys.fromJSON with base64url strings directly...`);
          try {
            const fallbackPromise = ApplicationServerKeys.fromJSON({
              publicKey: FALLBACK_VAPID_PUBLIC_KEY,
              privateKey: FALLBACK_VAPID_PRIVATE_KEY,
            });
            const fallbackTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Fallback key loading timeout')), 5000);
            });
            applicationServerKeys = await Promise.race([fallbackPromise, fallbackTimeout]);
            console.log(`[test-push:${requestId}] SUCCESS: Hardcoded fallback keys loaded successfully with base64url strings!`);
          } catch (base64UrlError) {
            console.log(`[test-push:${requestId}] Base64url strings failed: ${base64UrlError instanceof Error ? base64UrlError.message : String(base64UrlError)}, trying JWK conversion...`);
            // Convert fallback keys from base64url to JWK format
            console.log(`[test-push:${requestId}] Converting fallback keys to JWK format...`);
            const fallbackKeysJWK = await convertBase64UrlKeysToJWK(FALLBACK_VAPID_PUBLIC_KEY, FALLBACK_VAPID_PRIVATE_KEY);
            console.log(`[test-push:${requestId}] Successfully converted fallback keys to JWK format`);
            
            // Try with JWK objects as JSON strings
            console.log(`[test-push:${requestId}] Attempting ApplicationServerKeys.fromJSON with JWK JSON strings...`);
            try {
              const fallbackPromise = ApplicationServerKeys.fromJSON({
                publicKey: JSON.stringify(fallbackKeysJWK.publicKey),
                privateKey: JSON.stringify(fallbackKeysJWK.privateKey),
              });
              const fallbackTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Fallback key loading timeout')), 5000);
              });
              applicationServerKeys = await Promise.race([fallbackPromise, fallbackTimeout]);
              console.log(`[test-push:${requestId}] SUCCESS: Hardcoded fallback keys loaded successfully with JWK JSON strings!`);
            } catch (jwkStringError) {
              console.error(`[test-push:${requestId}] JWK JSON strings also failed: ${jwkStringError instanceof Error ? jwkStringError.message : String(jwkStringError)}`);
              throw jwkStringError; // Re-throw since objects don't work either
            }
          }
        } catch (fallbackError) {
          console.log(`[test-push:${requestId}] Fallback keys also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}, trying conversions...`);
          
          // If loading failed and keys are base64url strings, try converting to JWK
          if (typeof publicKey === 'string' && typeof privateKey === 'string') {
            console.log(`[test-push:${requestId}] Direct use failed (${loadError instanceof Error ? loadError.message : String(loadError)}), attempting conversion...`);
            
            // First, try to use keys as-is without any conversion (in case they're already in correct format)
            console.log(`[test-push:${requestId}] Attempting to use keys as-is (no conversion)...`);
            try {
            const directPromise = ApplicationServerKeys.fromJSON({
              publicKey: publicKey.trim(),
              privateKey: privateKey.trim(),
            });
            const directTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), 5000);
            });
            applicationServerKeys = await Promise.race([directPromise, directTimeout]);
            console.log(`[test-push:${requestId}] Successfully loaded keys as-is (no conversion needed)`);
          } catch (directError) {
            console.log(`[test-push:${requestId}] Direct use failed, trying base64url to JWK conversion...`);
            try {
              const convertedKeys = await convertBase64UrlKeysToJWK(publicKey, privateKey);
              console.log(`[test-push:${requestId}] Successfully converted base64url keys to JWK format`);
              // Retry with JWK as JSON strings
              const retryPromise = ApplicationServerKeys.fromJSON({
                publicKey: JSON.stringify(convertedKeys.publicKey),
                privateKey: JSON.stringify(convertedKeys.privateKey),
              });
              const retryTimeout = new Promise((_, reject) => {
                setTimeout(() => {
                  reject(new Error('VAPID key loading timeout after 5 seconds (retry)'));
                }, 5000);
              });
              applicationServerKeys = await Promise.race([retryPromise, retryTimeout]);
              console.log(`[test-push:${requestId}] ApplicationServerKeys loaded successfully after JWK conversion`);
            } catch (convertError) {
              console.error(`[test-push:${requestId}] All conversion attempts failed. Last error:`, convertError);
              console.error(`[test-push:${requestId}] Public key sample (first 100 chars):`, publicKey.substring(0, 100));
              console.error(`[test-push:${requestId}] Private key sample (first 100 chars):`, privateKey.substring(0, 100));
              
              // Final fallback: use hardcoded keys
              console.log(`[test-push:${requestId}] FINAL FALLBACK: All conversions failed, using hardcoded fallback keys`);
              try {
                // Try with base64url strings directly first (fallback keys are already in base64url format)
                console.log(`[test-push:${requestId}] Attempting ApplicationServerKeys.fromJSON with base64url strings directly...`);
                try {
                  const fallbackPromise = ApplicationServerKeys.fromJSON({
                    publicKey: FALLBACK_VAPID_PUBLIC_KEY,
                    privateKey: FALLBACK_VAPID_PRIVATE_KEY,
                  });
                  const fallbackTimeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Fallback key loading timeout')), 5000);
                  });
                  applicationServerKeys = await Promise.race([fallbackPromise, fallbackTimeout]);
                  console.log(`[test-push:${requestId}] Successfully loaded hardcoded fallback keys with base64url strings!`);
                } catch (base64UrlError) {
                  console.log(`[test-push:${requestId}] Base64url strings failed: ${base64UrlError instanceof Error ? base64UrlError.message : String(base64UrlError)}, trying JWK conversion...`);
                  // Convert fallback keys from base64url to JWK format
                  console.log(`[test-push:${requestId}] Converting fallback keys to JWK format...`);
                  const fallbackKeysJWK = await convertBase64UrlKeysToJWK(FALLBACK_VAPID_PUBLIC_KEY, FALLBACK_VAPID_PRIVATE_KEY);
                  console.log(`[test-push:${requestId}] Successfully converted fallback keys to JWK format`);
                  
                  // Try with JWK objects as JSON strings
                  console.log(`[test-push:${requestId}] Attempting ApplicationServerKeys.fromJSON with JWK JSON strings...`);
                  try {
                    const fallbackPromise = ApplicationServerKeys.fromJSON({
                      publicKey: JSON.stringify(fallbackKeysJWK.publicKey),
                      privateKey: JSON.stringify(fallbackKeysJWK.privateKey),
                    });
                    const fallbackTimeout = new Promise((_, reject) => {
                      setTimeout(() => reject(new Error('Fallback key loading timeout')), 5000);
                    });
                    applicationServerKeys = await Promise.race([fallbackPromise, fallbackTimeout]);
                    console.log(`[test-push:${requestId}] Successfully loaded hardcoded fallback keys with JWK JSON strings!`);
                  } catch (jwkStringError) {
                    console.error(`[test-push:${requestId}] JWK JSON strings also failed: ${jwkStringError instanceof Error ? jwkStringError.message : String(jwkStringError)}`);
                    throw jwkStringError; // Re-throw since objects don't work either
                  }
                }
              } catch (fallbackError) {
                console.error(`[test-push:${requestId}] Even fallback keys failed:`, fallbackError);
                throw convertError; // Throw original error, not fallback error
              }
            }
          }
          } // Close if (typeof publicKey === 'string' && typeof privateKey === 'string')
        }
      }
      const keyLoadDuration = Date.now() - keyLoadStartTime;
      console.log(`[test-push:${requestId}] ApplicationServerKeys loaded successfully (took ${keyLoadDuration}ms)`);
      
      // Check if keys match (if we tested them)
      if (keysMatch === false) {
        console.error(`[test-push:${requestId}] ===== KEY MISMATCH DETECTED =====`);
        console.error(`[test-push:${requestId}] The VAPID public and private keys are from different key pairs.`);
        console.error(`[test-push:${requestId}] This will cause "InconsistentComponents" errors when trying to send notifications.`);
        return new Response(JSON.stringify({ 
          error: 'VAPID keys mismatch', 
          details: 'The public and private VAPID keys are from different key pairs. They must be from the same pair.',
          solution: 'Regenerate the VAPID keys using the generate-vapid-keys function and update both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets in Supabase.',
          requestId,
          duration: keyLoadDuration
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (keyError) {
      const keyLoadDuration = Date.now() - keyLoadStartTime;
      console.error(`[test-push:${requestId}] Failed to load VAPID keys after ${keyLoadDuration}ms:`, keyError);
      console.error(`[test-push:${requestId}] Error details:`, String(keyError));
      console.error(`[test-push:${requestId}] Error stack:`, keyError instanceof Error ? keyError.stack : 'No stack trace');
      console.error(`[test-push:${requestId}] VAPID_PUBLIC_KEY type:`, typeof VAPID_PUBLIC_KEY);
      console.error(`[test-push:${requestId}] VAPID_PRIVATE_KEY type:`, typeof VAPID_PRIVATE_KEY);
      return new Response(JSON.stringify({ 
        error: 'Invalid VAPID key format', 
        details: String(keyError),
        duration: keyLoadDuration,
        hint: 'VAPID keys should be in JWK format (JSON) or base64url format. Check Supabase secrets.',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body to get title and body (if provided)
    console.log(`[test-push:${requestId}] Parsing request body...`);
    let requestBody: { title?: string; body?: string } = {};
    try {
      requestBody = await req.json();
      console.log(`[test-push:${requestId}] Request body parsed successfully`);
    } catch (e) {
      console.log(`[test-push:${requestId}] No request body provided, using defaults`);
    }

    const title = requestBody.title || '🚌 Test Push Notification';
    const body = requestBody.body || 'Οι ειδοποιήσεις λειτουργούν σωστά!';
    console.log(`[test-push:${requestId}] Notification title: "${title}", body: "${body}"`);

    console.log(`[test-push:${requestId}] Creating Supabase client...`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log(`[test-push:${requestId}] Supabase client created`);

    // Get subscriptions from BOTH tables
    console.log(`[test-push:${requestId}] Fetching subscriptions from database...`);
    const dbFetchStartTime = Date.now();
    const { data: stopSubs, error: stopError } = await supabase
      .from('stop_notification_subscriptions')
      .select('endpoint, p256dh, auth');

    const { data: pushSubs, error: pushError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');
    
    const dbFetchDuration = Date.now() - dbFetchStartTime;
    console.log(`[test-push:${requestId}] Database fetch completed in ${dbFetchDuration}ms`);

    if (stopError) console.error(`[test-push:${requestId}] Error fetching stop subscriptions:`, stopError);
    if (pushError) console.error(`[test-push:${requestId}] Error fetching push subscriptions:`, pushError);

    // Merge subscriptions, avoiding duplicates by endpoint
    console.log(`[test-push:${requestId}] Merging subscriptions...`);
    const allSubs = [...(stopSubs || []), ...(pushSubs || [])];
    const uniqueEndpoints = new Map();
    allSubs.forEach(sub => uniqueEndpoints.set(sub.endpoint, sub));
    const subscriptions = Array.from(uniqueEndpoints.values());

    console.log(`[test-push:${requestId}] Found ${stopSubs?.length || 0} stop subs, ${pushSubs?.length || 0} push subs, ${subscriptions.length} unique total`);

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[test-push:${requestId}] No subscriptions found, returning early`);
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found', requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[test-push:${requestId}] Creating notification payload...`);
    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-192x192.png',
      url: '/',
    });
    console.log(`[test-push:${requestId}] Payload created (${payload.length} bytes)`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Helper function to add timeout to fetch
    async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
    }

    console.log(`[test-push:${requestId}] Starting to process ${subscriptions.length} subscriptions...`);
    for (const sub of subscriptions) {
      const subStartTime = Date.now();
      try {
        console.log(`[test-push] Processing subscription: ${new URL(sub.endpoint).hostname}`);

        // Convert keys to base64url format if they're in standard base64
        const p256dh = toBase64Url(sub.p256dh);
        const auth = toBase64Url(sub.auth);

        console.log(`[test-push] Generating push request...`);
        let pushRequest;
        try {
          pushRequest = await generatePushHTTPRequest({
            applicationServerKeys,
            payload,
            target: {
              endpoint: sub.endpoint,
              keys: {
                p256dh,
                auth,
              },
            },
            adminContact: 'mailto:info@motionbus.cy',
            ttl: 86400,
            urgency: 'high',
          });
          console.log(`[test-push] Push request generated in ${Date.now() - subStartTime}ms`);
        } catch (pushError: any) {
          if (pushError?.message?.includes('InconsistentComponents') || pushError?.name === 'InconsistentComponents') {
            const errorMsg = 'VAPID keys are from different key pairs. They must be regenerated as a matching pair. Use the generate-vapid-keys function to create new matching keys.';
            console.error(`[test-push:${requestId}] ${errorMsg}`);
            throw new Error(errorMsg);
          }
          throw pushError;
        }
        const { headers, body, endpoint } = pushRequest;

        console.log(`[test-push:${requestId}] Push request details:`);
        console.log(`[test-push:${requestId}] Endpoint: ${endpoint.substring(0, 80)}...`);
        console.log(`[test-push:${requestId}] Headers:`, JSON.stringify(Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, k === 'Authorization' ? (v as string).substring(0, 50) + '...' : v]))));
        console.log(`[test-push:${requestId}] Body length: ${body ? body.length : 0} bytes`);
        
        console.log(`[test-push] Sending push to endpoint (10s timeout)...`);
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers,
          body,
        }, 10000);

        if (response.ok) {
          sent++;
          const subDuration = Date.now() - subStartTime;
          console.log(`[test-push:${requestId}] Push succeeded with status ${response.status} (took ${subDuration}ms)`);
        } else {
          const responseText = await response.text();
          failed++;
          const errorMsg = `${response.status}: ${responseText.substring(0, 500)}`;
          errors.push(errorMsg);
          const subDuration = Date.now() - subStartTime;
          console.log(`[test-push:${requestId}] Push failed with status ${response.status} (took ${subDuration}ms): ${errorMsg}`);
          console.log(`[test-push:${requestId}] ==== DETAILED ERROR INFO START ====`);
          try {
            const responseHeadersObj = Object.fromEntries(response.headers.entries());
            console.log(`[test-push:${requestId}] Response headers JSON: ${JSON.stringify(responseHeadersObj)}`);
            console.log(`[test-push:${requestId}] Response body length: ${responseText.length}`);
            console.log(`[test-push:${requestId}] Response body content: "${responseText}"`);
            console.log(`[test-push:${requestId}] Response body (raw):`, responseText);
          } catch (logError) {
            console.log(`[test-push:${requestId}] Error logging response details: ${logError}`);
          }
          console.log(`[test-push:${requestId}] ==== DETAILED ERROR INFO END ====`);
          
          // Detect VAPID key mismatch errors
          const isVapidMismatch = response.status === 401 || 
                                  response.status === 403 || 
                                  responseText.includes('VapidPkHashMismatch') ||
                                  responseText.includes('VAPID credentials') ||
                                  responseText.includes('do not correspond');
          
          if (isVapidMismatch) {
            console.error(`[test-push:${requestId}] ⚠️ VAPID KEY MISMATCH DETECTED`);
            console.error(`[test-push:${requestId}] This subscription was created with a DIFFERENT VAPID public key.`);
            console.error(`[test-push:${requestId}] SOLUTION: Users need to resubscribe to push notifications with the new VAPID key.`);
            console.error(`[test-push:${requestId}] The frontend has been updated with the new key, so new subscriptions will work.`);
            // Remove the subscription so it can be recreated with the new key
            try {
              await supabase.from('stop_notification_subscriptions').delete().eq('endpoint', sub.endpoint);
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              console.log(`[test-push:${requestId}] Removed subscription with mismatched VAPID key (user needs to resubscribe)`);
            } catch (deleteError) {
              console.error(`[test-push:${requestId}] Failed to delete subscription:`, deleteError);
            }
          }
          
          // Remove invalid/expired subscriptions
          if (response.status === 410 || response.status === 404) {
            try {
              await supabase.from('stop_notification_subscriptions').delete().eq('endpoint', sub.endpoint);
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              console.log(`[test-push:${requestId}] Removed invalid/expired subscription`);
            } catch (deleteError) {
              console.error(`[test-push:${requestId}] Failed to delete subscription:`, deleteError);
            }
          }
        }
      } catch (error: any) {
        failed++;
        const errorMsg = error.message || String(error);
        errors.push(errorMsg);
        const subDuration = Date.now() - subStartTime;
        console.error(`[test-push:${requestId}] Push error (took ${subDuration}ms):`, errorMsg);
        console.error(`[test-push:${requestId}] Error stack:`, error.stack || 'No stack trace');
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[test-push:${requestId}] ===== PROCESSING COMPLETE =====`);
    console.log(`[test-push:${requestId}] Results: ${sent} sent, ${failed} failed (took ${duration}ms)`);
    
    // Check if there were VAPID key mismatches
    const hasVapidMismatches = errors.some(e => 
      e.includes('401') || 
      e.includes('403') || 
      e.includes('VapidPkHashMismatch') ||
      e.includes('VAPID credentials')
    );
    
    if (hasVapidMismatches && failed > 0) {
      console.log(`[test-push:${requestId}] ⚠️ NOTE: Some failures are due to VAPID key mismatches.`);
      console.log(`[test-push:${requestId}] Users with old subscriptions need to resubscribe with the new VAPID key.`);
      console.log(`[test-push:${requestId}] The frontend has been updated, so new subscriptions will work correctly.`);
    }

    const responseBody = { 
      sent, 
      failed, 
      total: subscriptions.length, 
      errors: errors.slice(0, 5), 
      duration, 
      requestId,
      note: hasVapidMismatches ? 'Some failures are due to VAPID key mismatches. Users need to resubscribe with the new key.' : undefined
    };
    console.log(`[test-push:${requestId}] ===== PREPARING RESPONSE =====`);
    console.log(`[test-push:${requestId}] Returning response (took ${duration}ms):`, JSON.stringify(responseBody));
    console.log(`[test-push:${requestId}] ===== FUNCTION END =====`);
    
    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[test-push:${requestId}] Error after ${duration}ms:`, error);
    console.error(`[test-push:${requestId}] Error stack:`, error instanceof Error ? error.stack : String(error));
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: String(error),
      requestId,
      duration 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
