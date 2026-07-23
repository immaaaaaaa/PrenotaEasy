const fs = require('fs');
const path = require('path');

const workspaceDir = 'c:/Users/immacolata/Desktop/lavoro/PrenotaEasy';
const supabaseJsPath = path.join(workspaceDir, 'node_modules', '@supabase', 'supabase-js');
const { createClient } = require(supabaseJsPath);

// Read .env.local
const envPath = path.join(workspaceDir, '.env.local');
console.log('Reading env from:', envPath);

if (!fs.existsSync(envPath)) {
  console.error('.env.local not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env.local');
  process.exit(1);
}

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data, error } = await supabase.from('businesses').select('*').limit(1);
    if (error) {
      console.log('Error reading businesses (maybe table does not exist):', error.message);
    } else {
      console.log('Successfully connected! Business table exists. Data sample:', data);
    }
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

check();
