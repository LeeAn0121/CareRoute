const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetStr = `        setIsOffline(true);
      }
    });
  };`;

const newStr = `        setIsOffline(true);
      }
      setDataLoaded(true); // Always unlock loading screen
    });
  };`;

code = code.replace(targetStr, newStr);

// Also let's check mapLoaded fallback to prevent hanging forever.
const targetMapLoadedFallback = `      if (attempts > 20) {
        clearInterval(checkMap);
      }`;
const newMapLoadedFallback = `      if (attempts > 50) { // Increase timeout to 5 seconds
        setMapLoaded(true); // Force unlock map
        clearInterval(checkMap);
      }`;

code = code.replace(targetMapLoadedFallback, newMapLoadedFallback);

fs.writeFileSync('src/app/page.tsx', code);
console.log("Fixed splash loading locks.");
