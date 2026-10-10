const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetMap = `<NaverMap
                ref={mapRef}
                defaultCenter={mapCenter}
                defaultZoom={mapZoom}
              >`;

const newMap = `<NaverMap
                ref={mapRef}
                defaultCenter={mapCenter}
                defaultZoom={mapZoom}
                onIdle={() => {
                  if (mapRef.current) {
                    const center = mapRef.current.getCenter();
                    const zoom = mapRef.current.getZoom();
                    // Prevent circular updates by checking difference
                    if (Math.abs(center.y - mapCenter.lat) > 0.0001 || Math.abs(center.x - mapCenter.lng) > 0.0001) {
                      setMapCenter({ lat: center.y, lng: center.x });
                    }
                    if (zoom !== mapZoom) setMapZoom(zoom);
                  }
                }}
              >`;

code = code.replace(targetMap, newMap);
fs.writeFileSync('src/app/page.tsx', code);
