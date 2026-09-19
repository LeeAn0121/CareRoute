import re

page_path = "src/app/page.tsx"

with open(page_path, "r", encoding="utf-8") as f:
    page_content = f.read()

handle_directions_func = """
  const handleDirections = (lat: number, lng: number, name: string) => {
    // 네이버 지도 길찾기 URL (PC/모바일 모두 호환성 좋은 방식)
    const url = `https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(name)}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`;
    window.open(url, '_blank');
  };
"""

page_content = page_content.replace(
    "const [activeTab, setActiveTab] = useState<'map' | 'list' | 'settings'>('map');",
    "const [activeTab, setActiveTab] = useState<'map' | 'list' | 'settings'>('map');\n" + handle_directions_func
)

# First button is inside markers.map, variable is `marker`
page_content = re.sub(
    r"onClick=\{\(\) => alert\('길안내 기능 \(네이버 지도 앱 등\) 연동 예정'\)\}(.*?)aria-label=\{\`\$\{marker.name\}",
    r"onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}\1aria-label={`\${marker.name}",
    page_content,
    flags=re.DOTALL
)

# Second button is inside selectedRecipient block, variable is `selectedRecipient`
page_content = re.sub(
    r"onClick=\{\(\) => alert\('길안내 기능 \(네이버 지도 앱 등\) 연동 예정'\)\}(.*?)\>\n\s*<Navigation",
    r"onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}\1>\n              <Navigation",
    page_content,
    flags=re.DOTALL
)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(page_content)
print("Done")
