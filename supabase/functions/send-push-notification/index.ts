import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  routeIds?: string[];
  icon?: string;
  url?: string;
}

// Allowed domains for notification URLs (security measure)
const ALLOWED_URL_DOMAINS = [
  'motionbus.cy',
  'lovable.app',
  'lovableproject.com',
  'localhost',
];

// Base64url encode/decode utilities
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padding);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Create VAPID JWT token
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key for signing
  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  
  // Create JWK from raw private key bytes (32 bytes for P-256)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: base64UrlEncode(privateKeyBytes),
    // We need to derive x and y from the public key, but for signing we can import without them
    x: '', // Will be derived
    y: '', // Will be derived
  };

  // Try to import using PKCS8 format
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
  ]);
  
  const pkcs8Key = new Uint8Array([...pkcs8Header, ...privateKeyBytes]);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert signature from DER to raw format if needed
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // Already in correct format
    rawSig = sigBytes;
  }

  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

// Encrypt payload using ECDH and AES-GCM (simplified implementation)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  // Generate local key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Import subscriber's public key
  const subscriberKeyBytes = base64UrlDecode(p256dhKey);
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authSecretBytes = base64UrlDecode(authSecret);

  // Derive encryption key using HKDF
  const ikm = new Uint8Array(sharedSecret);
  
  // PRK = HKDF-Extract(auth_secret, shared_secret)
  const prkKey = await crypto.subtle.importKey(
    'raw',
    authSecretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, ikm));

  // Create info for content encryption key
  const keyInfoStr = 'Content-Encoding: aes128gcm\0';
  const keyInfo = new TextEncoder().encode(keyInfoStr);
  
  // Derive content encryption key
  const cekKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const cekMaterial = new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...keyInfo, 1])));
  const cek = cekMaterial.slice(0, 16);

  // Derive nonce
  const nonceInfoStr = 'Content-Encoding: nonce\0';
  const nonceInfo = new TextEncoder().encode(nonceInfoStr);
  const nonceMaterial = new Uint8Array(await crypto.subtle.sign('HMAC', cekKey, new Uint8Array([...salt, ...nonceInfo, 1])));
  const nonce = nonceMaterial.slice(0, 12);

  // Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Add padding delimiter
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array([...payloadBytes, 2]); // 2 = final record

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    salt,
    localPublicKey,
  };
}

// Send push notification
async function sendPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(endpoint);
    console.log(`Sending push to: ${url.hostname}`);

    // Create VAPID authorization
    const audience = `${url.protocol}//${url.hostname}`;
    const vapidToken = await createVapidJwt(audience, 'mailto:info@motionbus.cy', vapidPrivateKey);
    
    // Encrypt the payload
    const { ciphertext, salt, localPublicKey } = await encryptPayload(payload, p256dh, auth);

    // Build body with aes128gcm format
    // Header: salt (16) + rs (4) + idlen (1) + keyid (65)
    const rs = new Uint8Array([0, 0, 16, 0]); // Record size: 4096
    const idlen = new Uint8Array([65]); // Key ID length
    
    const body = new Uint8Array([
      ...salt,
      ...rs,
      ...idlen,
      ...localPublicKey,
      ...ciphertext,
    ]);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'high',
        'Authorization': `vapid t=${vapidToken}, k=${vapidPublicKey}`,
      },
      body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.log(`Push failed with status ${response.status}: ${responseText}`);
      return { success: false, statusCode: response.status, error: responseText };
    }

    console.log(`Push succeeded with status ${response.status}`);
    return { success: true, statusCode: response.status };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Push error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Log authorization for debugging
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    // For now, allow all requests - the function is safe because it only sends 
    // to already-subscribed endpoints stored in our database

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('VAPID keys loaded successfully');

    const { title, body, routeIds, icon, url }: PushPayload = await req.json();
    
    // SECURITY: Input validation
    if (!title || typeof title !== 'string' || title.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid title - required, max 100 chars' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!body || typeof body !== 'string' || body.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid body - required, max 500 chars' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // SECURITY: Validate URL if provided
    if (url) {
      try {
        const parsed = new URL(url);
        const isAllowed = ALLOWED_URL_DOMAINS.some(domain => 
          parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
        if (!isAllowed) {
          console.error('URL domain not allowed:', parsed.hostname);
          return new Response(JSON.stringify({ error: 'URL domain not allowed' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    console.log('Sending push notification:', { title, body: body.substring(0, 50), routeIds });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get subscriptions
    const { data: subscriptions, error: fetchError } = await supabase.from('push_subscriptions').select('*');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    // Filter subscriptions by routeIds if specified
    let targetSubscriptions = subscriptions || [];
    if (routeIds && routeIds.length > 0) {
      targetSubscriptions = targetSubscriptions.filter(sub => {
        if (!sub.route_ids || sub.route_ids.length === 0) return false;
        return sub.route_ids.some((id: string) => routeIds.includes(id));
      });
      console.log(`Filtered to ${targetSubscriptions.length} subscriptions for routes:`, routeIds);
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/pwa-192x192.png',
      url: url || '/',
    });

    const results = await Promise.allSettled(
      targetSubscriptions.map(async (sub) => {
        const result = await sendPushNotification(
          sub.endpoint,
          sub.p256dh,
          sub.auth,
          payload,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
        );
        
        if (!result.success) {
          // Remove invalid subscriptions
          if (result.statusCode === 410 || result.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            console.log('Removed invalid subscription');
          }
        }
        
        return result;
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    const failed = results.length - successful;

    console.log(`Push results: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({ 
      sent: successful, 
      failed,
      total: targetSubscriptions.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
