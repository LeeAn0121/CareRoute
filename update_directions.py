import re

page_path = "src/app/page.tsx"

with open(page_path, "r", encoding="utf-8") as f:
    page_content = f.read()

# Add handleDirections function inside the Home component
handle_directions_func = """
  const handleDirections = (lat: number, lng: number, name: string) => {
    // 네이버 지도 길찾기 URL (PC/모바일 모두 호환성 좋은 방식)
    const url = `https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(name)}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`;
    window.open(url, '_blank');
  };
"""

# Find a good place to insert it, maybe after handleCompletePostcode in the page if it exists? No, it's not in page.tsx.
# Let's insert it after `const [activeTab, setActiveTab] = useState<'map' | 'list' | 'settings'>('map');`
page_content = page_content.replace(
    "const [activeTab, setActiveTab] = useState<'map' | 'list' | 'settings'>('map');",
    "const [activeTab, setActiveTab] = useState<'map' | 'list' | 'settings'>('map');\n" + handle_directions_func
)

# Replace the alert in the list tab (marker is the variable)
page_content = page_content.replace(
    "onClick={() => alert('길안내 기능 (네이버 지도 앱 등) 연동 예정')}",
    "onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}"
)

# Replace the alert in the map popup (selectedRecipient is the variable)
# Wait, the second one uses `selectedRecipient.lat` etc.
# But my simple string replace will replace both with `marker.lat` which is wrong for the second one if `marker` is not defined there.
# Let's check the context of line 397. It's inside `{selectedRecipient && ...}`
pass
