import re

path = "src/app/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Interface
interface_search = "visit_time: string;"
interface_replace = "visit_time: string;\n  notes?: string | null;"
content = content.replace(interface_search, interface_replace)

# 2. Add Notifications useEffect
state_search = "const [isStandalone, setIsStandalone] = useState(true); // default true to hide initially"
state_replace = """const [isStandalone, setIsStandalone] = useState(true); // default true to hide initially
  
  // Notification Logic
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkAlarms = () => {
      const now = new Date();
      const currentYMD = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      markers.forEach(marker => {
        if (marker.notes === currentYMD && marker.visit_time.substring(0, 5) === currentHM) {
          const alarmKey = `alarm_${marker.id}_${currentYMD}_${currentHM}`;
          if (!localStorage.getItem(alarmKey)) {
            localStorage.setItem(alarmKey, 'true'); // Prevent duplicate fires
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('케어루트 알림 🚨', {
                body: `${marker.name} 어르신 방문 예정 시간입니다! (${marker.address})`,
                icon: '/CareRoute/icon-192.png'
              });
            } else {
              alert(`🚨 [케어루트 알림] ${marker.name} 어르신 방문 시간입니다!`);
            }
          }
        }
      });
    };

    const intervalId = setInterval(checkAlarms, 30000); // Check every 30 seconds
    return () => clearInterval(intervalId);
  }, [markers]);"""
content = content.replace(state_search, state_replace)

# 3. Display Date in Map Popup (Drawer)
drawer_search = "{`${selectedRecipient.visit_time.substring(0, 5)} 방문 예정`}"
drawer_replace = "{`${selectedRecipient.notes ? selectedRecipient.notes.substring(5) + ' ' : ''}${selectedRecipient.visit_time.substring(0, 5)} 방문 예정`}"
content = content.replace(drawer_search, drawer_replace)

# 4. Display Date in List View
list_search = "{`${marker.visit_time.substring(0, 5)} 방문`}"
list_replace = "{`${marker.notes ? marker.notes.substring(5) + ' ' : ''}${marker.visit_time.substring(0, 5)} 방문`}"
content = content.replace(list_search, list_replace)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Page notifications updated")
