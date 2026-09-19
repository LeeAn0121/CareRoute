import re

page_path = "src/app/page.tsx"
with open(page_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add mapLoaded state
state_search = "const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');"
state_replace = """const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const checkMap = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window.naver && window.naver.maps && window.naver.maps.Map) {
        setMapLoaded(true);
        clearInterval(checkMap);
      }
      if (attempts > 20) { // Stop checking after 10 seconds
        clearInterval(checkMap);
      }
    }, 500);
    return () => clearInterval(checkMap);
  }, []);"""

content = content.replace(state_search, state_replace)

# 2. Wrap the Container with mapLoaded condition
map_search = """<Container className="w-full h-full">
            <NaverMap
              defaultCenter={mapCenter}
              center={mapCenter}
              defaultZoom={15}
            >
              {markers.map((marker) => (
                <Marker
                  key={marker.id}
                  position={{ lat: marker.lat, lng: marker.lng }}
                  onClick={() => setSelectedRecipient(marker)}
                  icon={{
                    content: `
                      <div class="relative flex items-center justify-center w-10 h-10 ${selectedRecipient?.id === marker.id ? 'scale-110 z-50' : 'scale-100'} transition-transform duration-200">
                        <div class="absolute inset-0 bg-teal-500 rounded-full opacity-20 animate-ping"></div>
                        <div class="relative bg-teal-600 text-white rounded-full p-2 shadow-lg border-2 border-white">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                      </div>
                    `,
                    anchor: { x: 20, y: 20 }
                  }}
                />
              ))}
            </NaverMap>
          </Container>"""

map_replace = """{mapLoaded ? (
            <Container className="w-full h-full">
              <NaverMap
                defaultCenter={mapCenter}
                center={mapCenter}
                defaultZoom={15}
              >
                {markers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={{ lat: marker.lat, lng: marker.lng }}
                    onClick={() => setSelectedRecipient(marker)}
                    icon={{
                      content: `
                        <div class="relative flex items-center justify-center w-10 h-10 ${selectedRecipient?.id === marker.id ? 'scale-110 z-50' : 'scale-100'} transition-transform duration-200">
                          <div class="absolute inset-0 bg-teal-500 rounded-full opacity-20 animate-ping"></div>
                          <div class="relative bg-teal-600 text-white rounded-full p-2 shadow-lg border-2 border-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                        </div>
                      `,
                      anchor: { x: 20, y: 20 }
                    }}
                  />
                ))}
              </NaverMap>
            </Container>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 text-slate-500 px-6 text-center">
              <MapPin size={48} className="mb-4 opacity-30" />
              <p className="font-bold text-lg mb-2">지도를 불러올 수 없습니다</p>
              <p className="text-sm">네이버 지도 API 권한 에러(Error 210)이거나<br/>클라우드 서버 동기화가 지연 중입니다.<br/>(목록 탭은 정상 사용 가능합니다)</p>
            </div>
          )}"""

content = content.replace(map_search, map_replace)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
