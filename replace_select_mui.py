import re

page_path = "src/app/page.tsx"
with open(page_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add MUI imports to page.tsx
mui_imports = "import { Select, MenuItem, FormControl, InputLabel, Button, CircularProgress } from '@mui/material';"
content = content.replace("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\n" + mui_imports)

select_html = """          <div className="flex gap-2">
            <select
              value={selectedSido}
              onChange={(e) => setSelectedSido(e.target.value)}
              className="w-1/3 p-3 bg-slate-50 border-none rounded-xl text-[15px] font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none"
              aria-label="시/도 선택"
            >
              <option value="">시/도</option>
              {sidos.map(sido => <option key={sido.code} value={sido.code}>{sido.name}</option>)}
            </select>
            <select
              value={selectedSigungu}
              onChange={(e) => setSelectedSigungu(e.target.value)}
              className="w-1/3 p-3 bg-slate-50 border-none rounded-xl text-[15px] font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none"
              aria-label="시/군/구 선택"
              disabled={!selectedSido}
            >
              <option value="">시/군/구</option>
              {sigungus.map(sig => <option key={sig.code} value={sig.code}>{sig.name.split(' ').pop()}</option>)}
            </select>
            <select
              value={selectedDong}
              onChange={(e) => setSelectedDong(e.target.value)}
              className="w-1/3 p-3 bg-slate-50 border-none rounded-xl text-[15px] font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none"
              aria-label="동/읍/면 선택"
              disabled={!selectedSigungu}
            >
              <option value="">동/읍/면</option>
              {dongs.map(dong => <option key={dong.code} value={dong.code}>{dong.name.split(' ').pop()}</option>)}
            </select>
          </div>"""

mui_selects = """          <div className="flex gap-2">
            <FormControl size="small" sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 3 }}>
              <Select
                value={selectedSido}
                onChange={(e) => setSelectedSido(e.target.value)}
                displayEmpty
                sx={{ borderRadius: 3, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <MenuItem value="">시/도</MenuItem>
                {sidos.map(sido => <MenuItem key={sido.code} value={sido.code} sx={{fontWeight: 600}}>{sido.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 3 }} disabled={!selectedSido}>
              <Select
                value={selectedSigungu}
                onChange={(e) => setSelectedSigungu(e.target.value)}
                displayEmpty
                sx={{ borderRadius: 3, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <MenuItem value="">시/군/구</MenuItem>
                {sigungus.map(sig => <MenuItem key={sig.code} value={sig.code} sx={{fontWeight: 600}}>{sig.name.split(' ').pop()}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 3 }} disabled={!selectedSigungu}>
              <Select
                value={selectedDong}
                onChange={(e) => setSelectedDong(e.target.value)}
                displayEmpty
                sx={{ borderRadius: 3, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <MenuItem value="">동/읍/면</MenuItem>
                {dongs.map(dong => <MenuItem key={dong.code} value={dong.code} sx={{fontWeight: 600}}>{dong.name.split(' ').pop()}</MenuItem>)}
              </Select>
            </FormControl>
          </div>"""

content = content.replace(select_html, mui_selects)

with open(page_path, "w", encoding="utf-8") as f:
    f.write(content)

