const https = require('https');
const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.5&longitude=127.0&current=pm10,pm2_5&timezone=Asia%2FSeoul';
https.get(url, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});
