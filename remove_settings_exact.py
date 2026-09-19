import re

page_path = "src/app/page.tsx"

with open(page_path, "r", encoding="utf-8") as f:
    page_content = f.read()

# 1. Update state type
page_content = page_content.replace(
    "useState<'map' | 'list' | 'settings'>('map');",
    "useState<'map' | 'list'>('map');"
)

# 2. Remove settings UI block
settings_ui = """        {activeTab === 'settings' && (
          <div className="absolute inset-0 top-0 bg-slate-50 flex-1 overflow-y-auto pt-safe-top">
            <div className="px-5 py-6">
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-6">설정</h1>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">어머님 계정</h3>
                    <p className="text-sm text-slate-500">사회복지사</p>
                  </div>
                </div>
                <button className="w-full text-left p-5 text-slate-700 hover:bg-slate-50 transition-colors font-medium border-b border-slate-100">
                  앱 정보 (v1.0.0)
                </button>
                <button className="w-full text-left p-5 text-red-500 hover:bg-slate-50 transition-colors font-medium">
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}"""
page_content = page_content.replace(settings_ui, "")

# 3. Remove nav button
nav_button = """        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${activeTab === 'settings' ? 'text-teal-600' : 'text-slate-400 hover:text-teal-500'}`}
        >
          <div className={`${activeTab === 'settings' ? 'bg-teal-50' : ''} p-1.5 rounded-full mb-1`}>
            <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] ${activeTab === 'settings' ? 'font-bold' : 'font-medium'}`}>설정</span>
        </button>"""
page_content = page_content.replace(nav_button, "")

with open(page_path, "w", encoding="utf-8") as f:
    f.write(page_content)

print("Done")
