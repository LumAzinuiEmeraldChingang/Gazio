const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const username = 'e2eUser' + Date.now();
    console.log('Signing up user:', username);
    const signupData = JSON.stringify({ username, email: username + '@example.com', password: 'pass', 'confirm-password': 'pass' });
    const signup = await request({ hostname: '127.0.0.1', port: 3000, path: '/signup', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(signupData) } }, signupData);
    console.log('signup status', signup.statusCode);
    const setCookie = signup.headers['set-cookie'];
    const cookie = setCookie ? setCookie[0].split(';')[0] : null;
    console.log('set-cookie:', setCookie);

    // Add a bottle
    const bottle = { brand: 'E2E Brand', quantity: 5, price: 4200 };
    const bdata = JSON.stringify(bottle);
    console.log('Adding bottle for', username, bottle);
    const add = await request({ hostname: '127.0.0.1', port: 3000, path: '/add-bottle', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bdata), Cookie: cookie } }, bdata);
    console.log('add status', add.statusCode, 'body', add.body);

    // Fetch profile-data
    const pd = await request({ hostname: '127.0.0.1', port: 3000, path: '/profile-data', method: 'GET', headers: { Cookie: cookie } });
    console.log('profile-data response:', pd.body);
  } catch (err) {
    console.error('E2E error', err);
    process.exit(1);
  }
})();
