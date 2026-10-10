const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const oldCode = `        (error) => {
          console.warn("Initial GPS error:", error);
        }
      );`;

const newCode = `        (error) => {
          console.warn("Initial GPS error:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );`;

if (page.includes(oldCode)) {
    page = page.replace(oldCode, newCode);
    fs.writeFileSync('src/app/page.tsx', page);
    console.log("Patched GPS init options.");
} else {
    console.log("Could not find GPS init code block.");
}
