const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const importTarget = `import RecipientModal from '@/components/RecipientModal';`;
if (!page.includes('ScheduleAddModal')) {
    page = page.replace(importTarget, importTarget + `\nimport ScheduleAddModal from '@/components/ScheduleAddModal';`);
}

const componentTarget = `<RecipientModal`;
const newComponent = `      {isScheduleAddOpen && (
        <ScheduleAddModal 
          isOpen={isScheduleAddOpen}
          onClose={() => setIsScheduleAddOpen(false)}
          date={scheduleDate}
          allRecipients={markers}
          onSuccess={() => {
            fetchMarkers(); // refresh data
            setIsScheduleAddOpen(false);
          }}
        />
      )}
      
      <RecipientModal`;

if (!page.includes('<ScheduleAddModal')) {
    page = page.replace(componentTarget, newComponent);
}

fs.writeFileSync('src/app/page.tsx', page);
console.log("Patched modal imports.");
