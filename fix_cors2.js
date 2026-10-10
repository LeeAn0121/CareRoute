const fs = require('fs');
let content = fs.readFileSync('src/components/WeatherWidget.tsx', 'utf-8');

const target1 = 'const url = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;';
const new1 = 'const url = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;';

const target2 = `const data = await res.json();
        
        if (data?.response?.header?.resultCode === "00") {`;
        
const new2 = `const proxyData = await res.json();
        if (!proxyData.contents) throw new Error("No contents from proxy");
        const data = JSON.parse(proxyData.contents);
        
        if (data?.response?.header?.resultCode === "00") {`;

content = content.replace(target1, new1);
content = content.replace(target2, new2);

fs.writeFileSync('src/components/WeatherWidget.tsx', content);
console.log("Success replacing proxy");
