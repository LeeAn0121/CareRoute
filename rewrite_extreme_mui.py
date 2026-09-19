import re

page_path = "src/app/page.tsx"
with open(page_path, "r", encoding="utf-8") as f:
    content = f.read()

mui_imports = """import { Select, MenuItem, FormControl, Button, Fab, BottomNavigation, BottomNavigationAction, Paper, Typography, Card, CardContent, Drawer, Box, Chip, IconButton } from '@mui/material';"""

# Replace old imports
content = re.sub(r"import \{ Select.*?\} from '@mui/material';", mui_imports, content)

# 1. Update the Floating Header
old_header = """<header className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-4 border border-white/20">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-teal-500 rounded-xl flex items-center justify-center shadow-inner">
              <IconMapPin size={18} className="text-white" />
            </div>
            케어루트
          </h1>"""

new_header = """<header className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2">
        <Paper elevation={4} sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, letterSpacing: '-0.5px' }}>
            <Box sx={{ width: 36, height: 36, bgcolor: '#0d9488', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }}>
              <IconMapPin size={20} color="white" />
            </Box>
            케어루트
          </Typography>"""

content = content.replace(old_header, new_header)
content = content.replace("        </div>\n      </header>", "        </Paper>\n      </header>")

# 2. Update the FAB
old_fab = """<button
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        className="absolute bottom-[100px] right-6 z-40 w-16 h-16 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(13,148,136,0.4)] active:scale-90 transition-transform"
        aria-label="어르신 추가"
      >
        <IconPlus size={32} strokeWidth={2.5} />
      </button>"""

new_fab = """<Fab 
        color="primary" 
        aria-label="어르신 추가" 
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        sx={{ position: 'absolute', bottom: 100, right: 24, zIndex: 40, width: 64, height: 64, boxShadow: '0 8px 32px rgba(13,148,136,0.5)' }}
      >
        <IconPlus size={32} strokeWidth={2.5} />
      </Fab>"""

content = content.replace(old_fab, new_fab)

# 3. Update Bottom Navigation
old_bottom_nav = """<nav className="bg-white/90 backdrop-blur-lg border-t border-slate-100 flex p-2 pb-safe z-50 absolute bottom-0 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[32px]">
        <button
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1.5 rounded-2xl transition-all ${activeTab === 'map' ? 'text-teal-600' : 'text-slate-400'}`}
          onClick={() => setActiveTab('map')}
          aria-selected={activeTab === 'map'}
          role="tab"
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'map' ? 'bg-teal-50' : ''}`}>
            <IconMapPin size={24} strokeWidth={activeTab === 'map' ? 2.5 : 2} />
          </div>
          <span className={`text-[13px] ${activeTab === 'map' ? 'font-bold' : 'font-medium'}`}>지도 보기</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1.5 rounded-2xl transition-all ${activeTab === 'list' ? 'text-teal-600' : 'text-slate-400'}`}
          onClick={() => setActiveTab('list')}
          aria-selected={activeTab === 'list'}
          role="tab"
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'list' ? 'bg-teal-50' : ''}`}>
            <IconList size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
          </div>
          <span className={`text-[13px] ${activeTab === 'list' ? 'font-bold' : 'font-medium'}`}>명단 보기</span>
        </button>
      </nav>"""

new_bottom_nav = """<Paper sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, borderRadius: '32px 32px 0 0', overflow: 'hidden', boxShadow: '0 -10px 40px rgba(0,0,0,0.08)' }} elevation={8}>
        <BottomNavigation
          showLabels
          value={activeTab}
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{ height: 80, pb: 'env(safe-area-inset-bottom)' }}
        >
          <BottomNavigationAction 
            label="지도 보기" 
            value="map" 
            icon={<IconMapPin size={26} strokeWidth={activeTab === 'map' ? 2.5 : 2} />} 
            sx={{ '&.Mui-selected': { color: '#0d9488', fontWeight: 800 } }}
          />
          <BottomNavigationAction 
            label="명단 보기" 
            value="list" 
            icon={<IconList size={26} strokeWidth={activeTab === 'list' ? 2.5 : 2} />} 
            sx={{ '&.Mui-selected': { color: '#0d9488', fontWeight: 800 } }}
          />
        </BottomNavigation>
      </Paper>"""

content = content.replace(old_bottom_nav, new_bottom_nav)

# 4. Update Marker Popup to Drawer
old_popup = """{selectedRecipient && activeTab === 'map' && (
        <div className="absolute bottom-[100px] left-4 right-4 z-30 bg-white rounded-[24px] shadow-[0_20px_40px_rgb(0,0,0,0.12)] p-6 border border-slate-100 animate-fade-in-up">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {selectedRecipient.name} 어르신
              </h3>
              <div className="flex items-center gap-1.5 text-teal-600 font-bold mt-2 text-[16px]">
                <IconClock size={18} />
                {selectedRecipient.visit_time.substring(0, 5)} 방문 예정
              </div>
            </div>
            <button onClick={() => setSelectedRecipient(null)} className="p-2 text-slate-400 bg-slate-50 rounded-full active:bg-slate-200">
              <IconX size={20} />
            </button>
          </div>
          <p className="text-[16px] text-slate-600 font-medium mb-5 bg-slate-50 p-4 rounded-2xl leading-relaxed">
            {selectedRecipient.address}
          </p>
          <button 
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-slate-900/20"
            onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
          >
            <IconNavigation size={20} />
            길안내 시작
          </button>
        </div>
      )}"""

new_popup = """<Drawer
        anchor="bottom"
        open={Boolean(selectedRecipient && activeTab === 'map')}
        onClose={() => setSelectedRecipient(null)}
        PaperProps={{ sx: { borderTopLeftRadius: 32, borderTopRightRadius: 32, p: 3, pb: 14 } }}
        ModalProps={{ keepMounted: true }}
      >
        {selectedRecipient && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {selectedRecipient.name} 어르신
                </Typography>
                <Chip 
                  icon={<IconClock size={16} />} 
                  label={`${selectedRecipient.visit_time.substring(0, 5)} 방문 예정`} 
                  color="primary" 
                  variant="outlined" 
                  size="small" 
                  sx={{ mt: 1, fontWeight: 700, borderRadius: 2 }} 
                />
              </Box>
              <IconButton onClick={() => setSelectedRecipient(null)} sx={{ bgcolor: '#f1f5f9' }}>
                <IconX size={20} />
              </IconButton>
            </Box>
            <Paper elevation={0} sx={{ bgcolor: '#f8fafc', p: 2.5, borderRadius: 4, mb: 3 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569', lineHeight: 1.6 }}>
                {selectedRecipient.address}
              </Typography>
            </Paper>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<IconNavigation />}
              onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
              sx={{ py: 2, borderRadius: 4, fontSize: '1.1rem', fontWeight: 800, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, boxShadow: '0 8px 24px rgba(15,23,42,0.3)' }}
            >
              이곳으로 길안내 시작
            </Button>
          </Box>
        )}
      </Drawer>"""

content = content.replace(old_popup, new_popup)

# 5. Update List View Items
old_list_item_start = """<div key={marker.id} className="bg-white rounded-[24px] shadow-[0_2px_20px_rgb(0,0,0,0.03)] p-6 border border-slate-100 transition-all active:scale-[0.98]">"""
old_list_item_content = """<div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center">
                          <IconUser size={24} className="text-teal-600" />
                        </div>
                        <div>
                          <h2 className="text-[22px] font-black text-slate-900 tracking-tight">
                            {marker.name} 어르신
                          </h2>
                          <div className="flex items-center gap-1.5 text-teal-600 font-bold mt-1 text-[15px]">
                            <IconClock size={16} />
                            {marker.visit_time.substring(0, 5)} 방문
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingRecipient(marker); setIsModalOpen(true); }} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 active:bg-slate-200" aria-label="수정">
                          <IconPencil size={18} />
                        </button>
                        <button onClick={() => handleDelete(marker.id)} className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-400 active:bg-red-100" aria-label="삭제">
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                      <p className="text-[16px] text-slate-700 font-medium leading-relaxed flex items-start gap-2">
                        <IconMapPin size={18} className="text-slate-400 mt-1 shrink-0" />
                        {marker.address}
                      </p>
                    </div>

                    <button 
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-slate-900/20"
                      onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}
                    >
                      <IconNavigation size={20} />
                      이곳으로 길안내 시작
                    </button>
                  </div>"""

new_list_item = """<Card key={marker.id} elevation={0} sx={{ borderRadius: 5, mb: 3, border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.03)' }}>
                    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Box sx={{ width: 56, height: 56, bgcolor: '#f0fdfa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconUser size={28} color="#0d9488" />
                          </Box>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                              {marker.name} 어르신
                            </Typography>
                            <Chip 
                              icon={<IconClock size={14} />} 
                              label={`${marker.visit_time.substring(0, 5)} 방문`} 
                              size="small" 
                              sx={{ mt: 0.5, bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 800, borderRadius: 1.5, '& .MuiChip-icon': { color: '#0f766e' } }} 
                            />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton onClick={() => { setEditingRecipient(marker); setIsModalOpen(true); }} size="small" sx={{ bgcolor: '#f8fafc' }}>
                            <IconPencil size={18} />
                          </IconButton>
                          <IconButton onClick={() => handleDelete(marker.id)} size="small" sx={{ bgcolor: '#fef2f2', color: '#ef4444' }}>
                            <IconTrash size={18} />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      <Paper elevation={0} sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 3, mb: 2.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <IconMapPin size={20} color="#94a3b8" style={{ marginTop: 2, flexShrink: 0 }} />
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569', lineHeight: 1.5 }}>
                          {marker.address}
                        </Typography>
                      </Paper>

                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={<IconNavigation />}
                        onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}
                        sx={{ py: 1.5, borderRadius: 3, fontSize: '1.05rem', fontWeight: 800, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, boxShadow: '0 4px 14px rgba(15,23,42,0.2)' }}
                      >
                        길안내 시작
                      </Button>
                    </CardContent>
                  </Card>"""

# Using regex to replace the entire old list item block
content = re.sub(r'<div key=\{marker\.id\}.*?이곳으로 길안내 시작\s*</button>\s*</div>', new_list_item, content, flags=re.DOTALL)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(content)

print("MUI Extreme rewrite applied")
