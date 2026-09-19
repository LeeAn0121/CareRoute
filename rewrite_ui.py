import re

page_path = "src/app/page.tsx"
modal_path = "src/components/RecipientModal.tsx"

with open(page_path, "r", encoding="utf-8") as f:
    page_content = f.read()

# Replace header in page.tsx for better accessibility and design
page_content = page_content.replace(
    '''<header className="bg-white shadow-sm rounded-b-3xl px-5 pt-safe-top pb-5 z-20 absolute top-0 w-full">''',
    '''<header className="bg-white shadow-md rounded-b-3xl px-6 pt-safe-top pb-6 z-20 absolute top-0 w-full">'''
)
page_content = page_content.replace(
    '''<h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">케어루트</h1>''',
    '''<h1 className="text-3xl font-extrabold text-slate-900 tracking-tight" aria-label="케어루트 홈">케어루트</h1>'''
)
page_content = page_content.replace(
    '''className="flex-1 px-3 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"''',
    '''className="flex-1 px-4 py-3 text-base font-bold border-2 border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 appearance-none transition-all shadow-sm" aria-label="시/도 선택"'''
)
page_content = page_content.replace(
    '''className="flex-1 px-3 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none disabled:opacity-50"''',
    '''className="flex-1 px-4 py-3 text-base font-bold border-2 border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 appearance-none disabled:opacity-50 disabled:bg-slate-100 transition-all shadow-sm" aria-label="지역 선택"'''
)
page_content = page_content.replace(
    '''className="p-2 bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 transition-colors"''',
    '''className="p-3 bg-teal-100 text-teal-700 rounded-full hover:bg-teal-200 transition-colors focus:ring-4 focus:ring-teal-500/30 active:bg-teal-300 shadow-sm" aria-label="수급자 추가"'''
)
page_content = page_content.replace(
    '''<h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">''',
    '''<h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">'''
)
page_content = page_content.replace(
    '''<p className="text-slate-500 text-sm mt-1">{marker.address}</p>''',
    '''<p className="text-slate-600 text-base mt-2 font-medium leading-relaxed">{marker.address}</p>'''
)
page_content = page_content.replace(
    '''<button 
                        onClick={() => {
                          setMapCenter({ lat: marker.lat, lng: marker.lng });
                          setSelectedRecipient(marker);
                          setActiveTab('map');
                        }}
                        className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
                      >''',
    '''<button 
                        onClick={() => {
                          setMapCenter({ lat: marker.lat, lng: marker.lng });
                          setSelectedRecipient(marker);
                          setActiveTab('map');
                        }}
                        className="flex-1 bg-slate-200 text-slate-800 py-3 rounded-xl text-base font-bold hover:bg-slate-300 active:bg-slate-400 transition-colors focus:ring-4 focus:ring-slate-500/30"
                        aria-label={`${marker.name} 어르신 위치 지도로 보기`}
                      >'''
)
page_content = page_content.replace(
    '''<button 
                        className="flex-1 bg-teal-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors"
                        onClick={() => alert('길안내 기능 (네이버 지도 앱 등) 연동 예정')}
                      >''',
    '''<button 
                        className="flex-1 bg-teal-600 text-white py-3 rounded-xl text-base font-bold hover:bg-teal-700 active:bg-teal-800 transition-colors focus:ring-4 focus:ring-teal-500/30 shadow-md"
                        onClick={() => alert('길안내 기능 (네이버 지도 앱 등) 연동 예정')}
                        aria-label={`${marker.name} 어르신 길찾기`}
                      >'''
)
page_content = page_content.replace(
    '''<nav className="bg-white border-t border-slate-200 flex justify-around pb-safe-bottom">''',
    '''<nav className="bg-white border-t border-slate-200 flex justify-around pb-safe-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" aria-label="하단 네비게이션">'''
)
page_content = page_content.replace(
    '''<button 
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === 'map' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <MapPin size={24} />
          <span className="text-xs font-semibold">지도</span>
        </button>''',
    '''<button 
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors focus:outline-none focus:bg-slate-50 ${activeTab === 'map' ? 'text-teal-700 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}`}
          aria-label="지도 탭"
          aria-selected={activeTab === 'map'}
          role="tab"
        >
          <MapPin size={28} />
          <span className="text-sm">지도</span>
        </button>'''
)
page_content = page_content.replace(
    '''<button 
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === 'list' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <List size={24} />
          <span className="text-xs font-semibold">목록</span>
        </button>''',
    '''<button 
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors focus:outline-none focus:bg-slate-50 ${activeTab === 'list' ? 'text-teal-700 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}`}
          aria-label="목록 탭"
          aria-selected={activeTab === 'list'}
          role="tab"
        >
          <List size={28} />
          <span className="text-sm">목록</span>
        </button>'''
)
page_content = page_content.replace(
    '''<button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Settings size={24} />
          <span className="text-xs font-semibold">설정</span>
        </button>''',
    '''<button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors focus:outline-none focus:bg-slate-50 ${activeTab === 'settings' ? 'text-teal-700 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}`}
          aria-label="설정 탭"
          aria-selected={activeTab === 'settings'}
          role="tab"
        >
          <Settings size={28} />
          <span className="text-sm">설정</span>
        </button>'''
)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(page_content)

with open(modal_path, "r", encoding="utf-8") as f:
    modal_content = f.read()

modal_content = modal_content.replace(
    '''<h2 className="text-xl font-bold text-slate-800">''',
    '''<h2 className="text-2xl font-extrabold text-slate-900 tracking-tight" id="modal-title">'''
)
modal_content = modal_content.replace(
    '''<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in duration-200">''',
    '''<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="modal-title">'''
)
modal_content = modal_content.replace(
    '''<label className="block text-sm font-semibold text-slate-700 mb-1.5">이름</label>''',
    '''<label htmlFor="recipient-name" className="block text-base font-bold text-slate-800 mb-2">어르신 성함</label>'''
)
modal_content = modal_content.replace(
    '''<input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김할머니"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
                />''',
    '''<input 
                  id="recipient-name"
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김할머니"
                  className="w-full px-4 py-4 text-lg font-medium bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 transition-all shadow-sm"
                  aria-required="true"
                />'''
)
modal_content = modal_content.replace(
    '''<label className="block text-sm font-semibold text-slate-700 mb-1.5">주소</label>''',
    '''<label className="block text-base font-bold text-slate-800 mb-2">방문 주소</label>'''
)
modal_content = modal_content.replace(
    '''<button 
                    onClick={() => setIsSearchingAddress(true)}
                    className="px-4 py-3 bg-teal-50 text-teal-600 font-semibold rounded-xl hover:bg-teal-100 transition-colors whitespace-nowrap"
                  >''',
    '''<button 
                    onClick={() => setIsSearchingAddress(true)}
                    className="px-6 py-4 bg-teal-100 text-teal-800 text-base font-extrabold rounded-xl hover:bg-teal-200 active:bg-teal-300 transition-colors whitespace-nowrap focus:ring-4 focus:ring-teal-500/30"
                    aria-label="주소 검색 열기"
                  >'''
)
modal_content = modal_content.replace(
    '''className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"''',
    '''className="w-full px-4 py-4 text-lg font-medium bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 transition-all shadow-sm"'''
)
modal_content = modal_content.replace(
    '''className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed focus:outline-none"''',
    '''className="flex-1 px-4 py-4 text-lg font-medium bg-slate-100 border-2 border-slate-300 rounded-xl text-slate-700 cursor-not-allowed focus:outline-none" aria-readonly="true"'''
)
modal_content = modal_content.replace(
    '''<label className="block text-sm font-semibold text-slate-700 mb-1.5">방문 시간</label>''',
    '''<label htmlFor="visit-time" className="block text-base font-bold text-slate-800 mb-2">방문 예정 시간</label>'''
)
modal_content = modal_content.replace(
    '''<button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >''',
    '''<button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-5 text-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold rounded-2xl shadow-xl shadow-teal-600/30 transition-all focus:ring-4 focus:ring-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isSubmitting}
            >'''
)

with open(modal_path, "w", encoding="utf-8") as f:
    f.write(modal_content)

print("Done")
