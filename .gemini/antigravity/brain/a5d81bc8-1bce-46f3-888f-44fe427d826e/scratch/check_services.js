const fs = require('fs');
const path = require('path');

const workspaceDir = 'c:/Users/immacolata/Desktop/lavoro/PrenotaEasy';
const supabaseJsPath = path.join(workspaceDir, 'node_modules', '@supabase', 'supabase-js');
const { createClient } = require(supabaseJsPath);

const envPath = path.join(workspaceDir, '.env.local');
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
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('services').select('*').limit(1);
  if (error) {
    console.error('Error fetching services:', error);
  } else {
    console.log('Sample service record keys:', data.length > 0 ? Object.keys(data[0]) : 'No records found');
  }
}

run();
