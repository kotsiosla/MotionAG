import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert ArrayBuffer to base64url string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate ECDSA key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true, // extractable
      ['sign', 'verify']
    );

    // Export public key in raw format (uncompressed point)
    const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyBase64Url = arrayBufferToBase64Url(publicKeyRaw);

    // Export private key in PKCS8 format, then extract the raw 32-byte key
    const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    
    // For P-256, the raw private key is the last 32 bytes of the PKCS8 export
    // PKCS8 structure: sequence + version + algorithm + octet string containing the key
    const pkcs8Bytes = new Uint8Array(privateKeyPkcs8);
    // The private key value is at offset 36 and is 32 bytes long for P-256
    const privateKeyRaw = pkcs8Bytes.slice(-32);
    const privateKeyBase64Url = arrayBufferToBase64Url(privateKeyRaw.buffer);

    console.log('Generated new VAPID keys successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Copy these keys and add them as secrets:',
        keys: {
          VAPID_PUBLIC_KEY: publicKeyBase64Url,
          VAPID_PRIVATE_KEY: privateKeyBase64Url,
        },
        instructions: [
          '1. Copy the VAPID_PUBLIC_KEY value',
          '2. Add it as a secret named VAPID_PUBLIC_KEY',
          '3. Copy the VAPID_PRIVATE_KEY value', 
          '4. Add it as a secret named VAPID_PRIVATE_KEY',
          '5. Also update applicationServerKey in your frontend code'
        ]
      }, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating VAPID keys:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
