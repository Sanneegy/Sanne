const https = require('https');

const anonKey = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';

function checkTable(table) {
  return new Promise(resolve => {
    const options = {
      hostname: 'kqvoediolbpyvwpvbhty.supabase.co',
      path: `/rest/v1/${table}?select=*`,
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    };
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
  });
}

async function run() {
  console.log('Checking raw donations:', await checkTable('donations'));
  console.log('Checking raw orders:', await checkTable('orders'));
  console.log('Checking raw products:', await checkTable('products'));
}

run();
