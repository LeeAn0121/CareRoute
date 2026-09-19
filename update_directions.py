import re

page_path = "src/app/page.tsx"

with open(page_path, "r", encoding="utf-8") as f:
    content = f.read()

old_func = """  const handleDirections = (lat: number, lng: number, name: string) => {
    // 네이버 지도 길찾기 URL (PC/모바일 모두 호환성 좋은 방식)
    const url = `https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(name)}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`;
    window.open(url, '_blank');
  };"""

new_func = """  const handleDirections = (lat: number, lng: number, name: string) => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    
    if (isAndroid) {
      // 안드로이드: 시스템 지도 앱 선택 창 (geo intent)
      window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
    } else if (isIOS) {
      // iOS: 애플 지도
      window.location.href = `maps://?q=${encodeURIComponent(name)}&ll=${lat},${lng}`;
    } else {
      // PC: 네이버 지도 웹
      window.open(`https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(name)}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`, '_blank');
    }
  };"""

content = content.replace(old_func, new_func)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
