const fs = require('fs');
let code = fs.readFileSync('src/components/ScheduleAddModal.tsx', 'utf-8');

code = code.replace('onSuccess: () => void;', 'onSuccess: () => void;\n  onSelectRecipient: (r: Recipient) => void;');
code = code.replace('export default function ScheduleAddModal({ isOpen, onClose, date, allRecipients, onSuccess }: Props) {', 'export default function ScheduleAddModal({ isOpen, onClose, date, allRecipients, onSelectRecipient }: Props) {');

const handleAddFunc = `  const handleAdd = async (r: Recipient) => {
    setLoadingId(r.id);
    try {
      // Append the date to notes (which we are using to store specific dates)
      const existingDates = r.notes ? r.notes.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!existingDates.includes(ymd)) {
        existingDates.push(ymd);
      }
      const newNotes = existingDates.join(',');

      const { error } = await supabase.from('recipients').update({ notes: newNotes }).eq('id', r.id);
      if (error) throw error;
      
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('일정 추가 중 오류가 발생했습니다.');
    } finally {
      setLoadingId(null);
    }
  };`;

const newHandleAdd = `  const handleAdd = (r: Recipient) => {
    onClose();
    onSelectRecipient(r);
  };`;

code = code.replace(handleAddFunc, newHandleAdd);

fs.writeFileSync('src/components/ScheduleAddModal.tsx', code);
