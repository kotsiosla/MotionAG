// Quick script to set Supabase anon key
// Usage: node set-supabase-key.js YOUR_ANON_KEY

const fs = require('fs');
const path = require('path');

const key = process.argv[2];

if (!key) {
  console.log('❌ Please provide your Supabase anon key');
  console.log('Usage: node set-supabase-key.js YOUR_ANON_KEY');
  console.log('Get your key from: https://supabase.com/dashboard/project/mhlyndipnpwpcydjukig/settings/api');
  process.exit(1);
}

const envPath = path.join(__dirname, '.env');
const envContent = `VITE_SUPABASE_URL=https://mhlyndipnpwpcydjukig.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=${key}
`;

fs.writeFileSync(envPath, envContent);
console.log('✅ .env file created successfully!');
console.log('🔄 Please restart your dev server (Ctrl+C and npm run dev)');

