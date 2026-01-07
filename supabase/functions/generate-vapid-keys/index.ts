import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ApplicationServerKeys } from 'https://esm.sh/webpush-webcrypto@1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting VAPID key generation...');
    
    // Generate new VAPID keys using the library's built-in method
    const keys = await ApplicationServerKeys.generate();
    console.log('Keys generated successfully');
    
    // Export to JSON format that the library expects
    const keysJson = await keys.toJSON();
    console.log('Keys exported to JSON format');
    console.log('Public key type:', typeof keysJson?.publicKey);
    console.log('Private key type:', typeof keysJson?.privateKey);
    console.log('Public key length:', keysJson?.publicKey?.length);
    console.log('Private key length:', keysJson?.privateKey?.length);

    // Validate that keys exist
    if (!keysJson || !keysJson.publicKey || !keysJson.privateKey) {
      throw new Error(`Invalid keys format: keysJson=${!!keysJson}, publicKey=${!!keysJson?.publicKey}, privateKey=${!!keysJson?.privateKey}`);
    }

    console.log('Generated new VAPID keys successfully');

    const response = {
      success: true,
      message: 'These keys are in the correct format for webpush-webcrypto. They are from the same key pair and will work together.',
      keys: {
        VAPID_PUBLIC_KEY: keysJson.publicKey,
        VAPID_PRIVATE_KEY: keysJson.privateKey,
      },
      instructions: [
        '1. Copy the VAPID_PUBLIC_KEY value (the base64url string)',
        '2. Go to Supabase Dashboard → Settings → API → Secrets',
        '3. Update the secret named VAPID_PUBLIC_KEY with the copied value',
        '4. Copy the VAPID_PRIVATE_KEY value (the PKCS#8 base64 string)',
        '5. Update the secret named VAPID_PRIVATE_KEY with the copied value',
        '6. Update applicationServerKey in your frontend code with the new public key',
        '7. Test the test-push function to verify it works'
      ],
      note: 'These keys are guaranteed to match because they were generated together as a key pair.'
    };

    return new Response(
      JSON.stringify(response, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    console.error('Error generating VAPID keys:', errorMessage);
    console.error('Error stack:', errorStack);
    
    const errorResponse = {
      success: false,
      error: errorMessage,
      details: errorStack,
      hint: 'Make sure the webpush-webcrypto library is available and working correctly.'
    };
    
    return new Response(
      JSON.stringify(errorResponse, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
