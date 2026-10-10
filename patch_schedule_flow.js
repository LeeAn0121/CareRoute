const fs = require('fs');

// 1. In page.tsx, add managingScheduleRecipient state and ScheduleManageModal import
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');
const stateMarker = `const [isScheduleAddOpen, setIsScheduleAddOpen] = useState(false);`;
page = page.replace(stateMarker, stateMarker + `\n  const [managingScheduleRecipient, setManagingScheduleRecipient] = useState<Recipient | null>(null);`);

const importMarker = `import ScheduleAddModal from '@/components/ScheduleAddModal';`;
if (!page.includes('ScheduleManageModal')) {
  page = page.replace(importMarker, importMarker + `\nimport ScheduleManageModal from '@/components/ScheduleManageModal';`);
}

// 2. Render ScheduleManageModal in page.tsx
const renderMarker = `      {isScheduleAddOpen && (
        <ScheduleAddModal 
          isOpen={isScheduleAddOpen}
          onClose={() => setIsScheduleAddOpen(false)}
          date={scheduleDate as Date}
          allRecipients={markers}
          onSuccess={() => {
            fetchMarkers(); // refresh data
            setIsScheduleAddOpen(false);
          }}
        />
      )}`;

const renderManage = `
      <ScheduleManageModal
        isOpen={Boolean(managingScheduleRecipient)}
        onClose={() => setManagingScheduleRecipient(null)}
        recipient={managingScheduleRecipient}
        currentDate={scheduleDate || new Date()}
        onSuccess={() => {
          fetchMarkers();
          setManagingScheduleRecipient(null);
        }}
      />`;
if(!page.includes('<ScheduleManageModal')) {
  page = page.replace(renderMarker, renderMarker + renderManage);
}

// 3. Add '일정 관리' (Manage Schedule) button to the route card in page.tsx
// It goes next to '길안내' (Directions) and '방문 완료'
const routeButtons = `                          {!completed && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity"
                            >
                              <IconNavigation size={16} />
                              길안내
                            </button>
                          )}`;

const newRouteButtons = `                          {!completed && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity"
                            >
                              <IconNavigation size={16} />
                              길안내
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setManagingScheduleRecipient(marker); }}
                            className="flex-shrink-0 flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-bold bg-surface-muted text-foreground/70 hover:bg-surface-border transition-colors"
                          >
                            일정 관리
                          </button>`;
page = page.replace(routeButtons, newRouteButtons);

// Wait, the "Add to schedule" FAB still opens ScheduleAddModal.
// We need ScheduleAddModal to call `onSelectRecipient` instead of just saving.

fs.writeFileSync('src/app/page.tsx', page);
