const https = require('https');
const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=127.0&current=temperature_2m,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul';
https.get(url, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});
