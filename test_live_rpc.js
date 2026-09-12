const https = require('https');

const anonKey = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';
const url = 'https://kqvoediolbpyvwpvbhty.supabase.co/rest/v1/rpc/get_public_donation_total';

const options = {
  method: 'POST',
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', data);
  });
});

req.on('error', (e) => console.error(e));
req.end();
