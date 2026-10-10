const fs = require('fs');
let code = fs.readFileSync('src/components/ScheduleAddModal.tsx', 'utf-8');

const target = `<Input 
          icon={<IconSearch size={18} className="text-foreground/40" />} 
          placeholder="어르신 이름 검색..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />`;

const newCode = `<div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <IconSearch size={18} className="text-foreground/40" />
          </div>
          <input 
            type="text"
            className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-border rounded-xl outline-none focus:border-primary transition-colors text-foreground"
            placeholder="어르신 이름 검색..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>`;

code = code.replace(target, newCode);
fs.writeFileSync('src/components/ScheduleAddModal.tsx', code);
