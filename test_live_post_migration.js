const https = require('https');

const anonKey = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';
const baseUrl = 'https://kqvoediolbpyvwpvbhty.supabase.co/rest/v1/';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = baseUrl + path;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runLiveVerification() {
  console.log('================================================================');
  console.log('RUNNING LIVE SUPABASE DATABASE & RPC VERIFICATION');
  console.log('================================================================\n');

  // 1. Query Products
  const products = await makeRequest('products?select=*');
  console.log('1. Live Products Status:', products.status);
  console.log('   Data:', JSON.stringify(products.data, null, 2));

  // 2. Query Bundles & Components
  const bundles = await makeRequest('bundles?select=*');
  console.log('\n2. Live Bundles Status:', bundles.status);
  console.log('   Data:', JSON.stringify(bundles.data, null, 2));

  const components = await makeRequest('bundle_components?select=*');
  console.log('\n3. Live Bundle Components Status:', components.status);
  console.log('   Data:', JSON.stringify(components.data, null, 2));

  // 3. Query Promotions
  const promotions = await makeRequest('promotions?select=*');
  console.log('\n4. Live Promotions Status:', promotions.status);
  console.log('   Data:', JSON.stringify(promotions.data, null, 2));

  // 4. Query Delivery Zones
  const delivery = await makeRequest('delivery_zones?select=*');
  console.log('\n5. Live Delivery Zones Status:', delivery.status);
  console.log('   Data:', JSON.stringify(delivery.data, null, 2));

  // 5. Query Public Donation Total RPC
  const donationTotal = await makeRequest('rpc/get_public_donation_total', 'POST', {});
  console.log('\n6. Live Public Donation Total Status:', donationTotal.status);
  console.log('   Data:', JSON.stringify(donationTotal.data, null, 2));
}

runLiveVerification().catch(console.error);
