const fs = require('fs');
let code = fs.readFileSync('src/components/MonthCalendar.tsx', 'utf-8');

code = code.replace(
  'selectedDate: Date;',
  'selectedDate: Date | null;'
);

code = code.replace(
  'const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));',
  'const initialDate = selectedDate || new Date();\n  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));'
);

code = code.replace(
  'const isSelected = (d: number) => {',
  'const isSelected = (d: number) => {\n    if (!selectedDate) return false;'
);

fs.writeFileSync('src/components/MonthCalendar.tsx', code);
console.log("Patched MonthCalendar.tsx");
