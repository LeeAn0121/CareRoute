const fs = require('fs');
let content = fs.readFileSync('src/components/WeatherWidget.tsx', 'utf-8');

// Use the API route
content = content.replace(/const url = `https:\/\/apihub\.kma\.go\.kr.*`;/g, 'const url = `/api/weather?nx=${x}&ny=${y}&base_date=${base_date}&base_time=${base_time}`;');

// Remove the fallback UI so it doesn't show "Loading" or "Error" constantly if it's supposed to be sleek
content = content.replace(/if \(loading\) return <div[^>]*>날씨 로딩중...<\/div>; if \(!weather\) return <div[^>]*>날씨 에러!<\/div>;/g, 'if (loading || !weather) return null;');

// Add fade-in animation to the widget so it appears smoothly
content = content.replace(/className="fixed top-\[env\(safe-area-inset-top,0px\)\] right-4 mt-20 z-\[50\] pointer-events-auto"/g, 'className="fixed top-[env(safe-area-inset-top,0px)] right-4 mt-20 z-[50] pointer-events-auto animate-in fade-in slide-in-from-right-4"');

fs.writeFileSync('src/components/WeatherWidget.tsx', content);
console.log("Success updating widget to use API route");
