const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetState = `  const [mapLoaded, setMapLoaded] = useState(false);`;
const newState = `  const [mapLoaded, setMapLoaded] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  // 로딩 화면이 너무 빨리 사라지는 것을 방지 (최소 1.5초 유지)
  useEffect(() => {
    if (mapLoaded && dataLoaded) {
      const timer = setTimeout(() => setIsSplashVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, dataLoaded]);`;

page = page.replace(targetState, newState);

// Update fetchMarkers to set dataLoaded
const targetFetch = `    const { data, error } = await query;
    if (error) console.error(error);
    else {
      setMarkers(data || []);
      
      // Update geoCache for current bounds if map is available
      if (window.naver?.maps?.Event && mapRef.current) {
        window.naver.maps.Event.trigger(mapRef.current, 'idle');
      }
    }
  };`;

const newFetch = `    const { data, error } = await query;
    if (error) console.error(error);
    else {
      setMarkers(data || []);
      setDataLoaded(true);
      
      // Update geoCache for current bounds if map is available
      if (window.naver?.maps?.Event && mapRef.current) {
        window.naver.maps.Event.trigger(mapRef.current, 'idle');
      }
    }
  };`;
  
page = page.replace(targetFetch, newFetch);

// Now the UI injection for the Splash screen.
const targetReturn = `  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-background font-sans">
      
      {/* PWA Install Banner */}`;

const splashUI = `  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-background font-sans">
      
      <AnimatePresence>
        {isSplashVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[9999] bg-gradient-to-br from-primary via-[#1A2E55] to-accent flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Background Ornaments */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                animate={{ opacity: 0.15, scale: 1, rotate: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-white rounded-full blur-3xl"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                animate={{ opacity: 0.1, scale: 1, rotate: 0 }}
                transition={{ duration: 2.5, ease: "easeOut", delay: 0.2 }}
                className="absolute -bottom-[20%] -left-[10%] w-[80vw] h-[80vw] bg-accent rounded-full blur-3xl"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] shadow-2xl flex items-center justify-center mb-6 relative overflow-hidden">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-tr from-accent/40 to-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                <IconMapPin size={48} className="text-white drop-shadow-md relative z-10" />
              </div>
              
              <h1 className="text-4xl font-black text-white tracking-tight mb-2 drop-shadow-sm">케어루트</h1>
              <p className="text-white/80 font-medium tracking-tight">어르신 방문 요양의 새로운 기준</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-3"
            >
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                ))}
              </div>
              <p className="text-white/60 text-xs font-bold tracking-widest uppercase">
                {(!mapLoaded || !dataLoaded) ? '초기화 중...' : '준비 완료!'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}`;

page = page.replace(targetReturn, splashUI);
fs.writeFileSync('src/app/page.tsx', page);
console.log("Patched splash screen");
