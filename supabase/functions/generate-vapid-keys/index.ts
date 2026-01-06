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
    // Generate new VAPID keys using the library's built-in method
    const keys = await ApplicationServerKeys.generate();
    
    // Export to JSON format that the library expects
    const keysJson = await keys.toJSON();

    console.log('Generated new VAPID keys in JWK format successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'These keys are in the correct format for webpush-webcrypto:',
        keys: {
          VAPID_PUBLIC_KEY: keysJson.publicKey,
          VAPID_PRIVATE_KEY: keysJson.privateKey,
        },
        instructions: [
          '1. Copy the VAPID_PUBLIC_KEY value (the entire JSON string)',
          '2. Update the secret named VAPID_PUBLIC_KEY',
          '3. Copy the VAPID_PRIVATE_KEY value (the entire JSON string)', 
          '4. Update the secret named VAPID_PRIVATE_KEY',
          '5. Update applicationServerKey in frontend with the public key'
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
