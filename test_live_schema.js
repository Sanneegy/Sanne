const https = require('https');

const anonKey = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';
const baseUrl = 'https://kqvoediolbpyvwpvbhty.supabase.co/rest/v1/';

async function checkEndpoint(path) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    };
    https.get(baseUrl + path, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ path, statusCode: res.statusCode, body: data });
      });
    }).on('error', (err) => resolve({ path, error: err }));
  });
}

async function run() {
  const endpoints = [
    'orders?select=*&limit=1',
    'products?select=*&limit=1',
    'bundles?select=*&limit=1',
    'promotions?select=*&limit=1',
    'delivery_zones?select=*&limit=1',
    'donations?select=*&limit=1'
  ];

  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    console.log(`Endpoint: ${ep} | Status: ${res.statusCode} | Output: ${res.body}`);
  }
}

run();
