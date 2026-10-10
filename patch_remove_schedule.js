const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetLogic = `  const handleDelete = async (id: string) => {`;
const insertLogic = `  const handleRemoveFromSchedule = async (r: Recipient, date: Date) => {
    if (!window.confirm('해당 어르신을 이 날짜의 방문 일정에서 제외하시겠습니까?')) return;
    
    const ymd = \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`;
    const day = date.getDay();
    
    try {
      let newNotes = r.notes || '';
      if (newNotes.includes(ymd)) {
        newNotes = newNotes.split(',').map(s => s.trim()).filter(s => s && s !== ymd).join(',');
      }
      
      let newRecurring = r.recurring_weekdays || '';
      if (newRecurring.split(',').map(Number).includes(day)) {
        newRecurring = newRecurring.split(',').map(Number).filter(d => d !== day).join(',');
      }
      
      const { error } = await supabase.from('recipients').update({ 
        notes: newNotes || null,
        recurring_weekdays: newRecurring || null
      }).eq('id', r.id);
      
      if (error) throw error;
      
      // Update local state
      setMarkers(prev => prev.map(m => m.id === r.id ? { ...m, notes: newNotes || null, recurring_weekdays: newRecurring || null } : m));
    } catch (e) {
      console.error(e);
      alert('일정 제외 중 오류가 발생했습니다.');
    }
  };

`;

page = page.replace(targetLogic, insertLogic + targetLogic);

// Now add the UI button in the route card!
const targetUI = `{completed ? '완료 취소' : '방문 완료'}
                          </button>
                          
                          {!completed && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity"
                            >
                              <IconNavigation size={16} />
                              길안내
                            </button>
                          )}`;

const newUI = `{completed ? '완료 취소' : '방문 완료'}
                          </button>
                          
                          {!completed && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity"
                            >
                              <IconNavigation size={16} />
                              길안내
                            </button>
                          )}
                          
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromSchedule(marker, scheduleDate); }}
                            className="flex-shrink-0 flex items-center justify-center w-10 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            aria-label="일정에서 제외"
                          >
                            <IconX size={16} strokeWidth={3} />
                          </button>`;

page = page.replace(targetUI, newUI);
fs.writeFileSync('src/app/page.tsx', page);
console.log("Patched remove schedule logic and UI.");
