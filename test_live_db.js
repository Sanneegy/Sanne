const https = require('https');

const url = 'https://kqvoediolbpyvwpvbhty.supabase.co/rest/v1/products?select=*';
const options = {
  headers: {
    'apikey': 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst',
    'Authorization': 'Bearer sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', data);
  });
}).on('error', (e) => {
  console.error('Fetch error:', e);
});
