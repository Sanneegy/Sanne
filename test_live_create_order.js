const https = require('https');

const anonKey = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';
const url = 'https://kqvoediolbpyvwpvbhty.supabase.co/rest/v1/rpc/create_order';

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

req.write(JSON.stringify({
  p_idempotency_key: 'test_check_' + Date.now(),
  p_items: [{ id: 'p3', quantity: 1 }],
  p_customer_name: 'Test',
  p_customer_phone: '01000000000',
  p_city: 'Cairo',
  p_address: 'Test',
  p_payment_method: 'cash',
  p_donation_amount: 0
}));

req.on('error', (e) => console.error(e));
req.end();
