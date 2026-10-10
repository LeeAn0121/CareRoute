const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Remove 'settings' from Bottom Navigation
const navOld = /\{key: 'settings' as const, label: '설정', Icon: IconSettings \},/;
content = content.replace(navOld, '');

// 2. Add Top-Right User Menu Button to Map Header
const mapHeaderOld = /\{\/\* Integrated Compact Weather \*\/\}\s*<div className="px-5 pb-3 pt-0 flex justify-start">\s*<WeatherWidget lat=\{mapCenter\.lat\} lng=\{mapCenter\.lng\} \/>\s*<\/div>\s*<\/div>/;
const mapHeaderNew = `{/* Integrated Compact Weather */}
          <div className="px-5 pb-3 pt-0 flex justify-start">
            <WeatherWidget lat={mapCenter.lat} lng={mapCenter.lng} />
          </div>
        </div>

        {/* Top-Right User Menu / Settings Button */}
        <button 
          onClick={() => setActiveTab('settings')}
          className="pointer-events-auto flex-shrink-0 w-12 h-12 flex items-center justify-center bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 hover:bg-foreground/[0.04] transition-all active:scale-90"
        >
          <IconMenu2 size={24} className="text-foreground/80" strokeWidth={2.5} />
        </button>`;

content = content.replace(mapHeaderOld, mapHeaderNew);

// Since flex-col was on the parent header but now we have flex-row for Pill + Menu Button, we need to fix the header's flex
const headerTagOld = /<header className="absolute top-\[env\(safe-area-inset-top,0px\)\] left-4 right-4 z-20 flex flex-col gap-3 mt-3 pointer-events-none">/;
const headerTagNew = `<header className="absolute top-[env(safe-area-inset-top,0px)] left-4 right-4 z-20 flex items-start gap-3 mt-3 pointer-events-none">`;
content = content.replace(headerTagOld, headerTagNew);

// Ensure the Pill has flex-1
const pillOld = /<div className="flex flex-col pointer-events-auto bg-surface\/85/;
const pillNew = `<div className="flex-1 flex flex-col pointer-events-auto bg-surface/85`;
content = content.replace(pillOld, pillNew);

// 3. Make sure IconMenu2 is imported
if (!content.includes('IconMenu2')) {
    content = content.replace(/IconMenu,/, 'IconMenu, IconMenu2,');
    if (!content.includes('IconMenu2')) {
        content = content.replace(/IconTrash,/, 'IconTrash, IconMenu2,');
    }
}

// 4. Hide Bottom Nav when in Settings
const bottomNavContainerOld = /<div className="absolute bottom-6 left-4 right-4 z-50 px-2 pb-safe">/;
const bottomNavContainerNew = `<div className={\`absolute bottom-6 left-4 right-4 z-50 px-2 pb-safe transition-transform duration-500 \${activeTab === 'settings' ? 'translate-y-[150%]' : 'translate-y-0'}\`}>`;
content = content.replace(bottomNavContainerOld, bottomNavContainerNew);

fs.writeFileSync('src/app/page.tsx', content);

// 5. Add Back Button to SettingsView.tsx
let settingsContent = fs.readFileSync('src/components/SettingsView.tsx', 'utf-8');
const titleOld = /<div className="mb-8 px-2">\s*<h2 className="text-\[34px\] font-black tracking-tighter text-foreground">설정<\/h2>\s*<\/div>/;
const titleNew = `<div className="flex items-center gap-4 mb-8 px-2">
        <button 
          onClick={() => {
            // Find a way to go back or just use a standard button that triggers an event
            const btn = document.getElementById('back-to-map-btn');
            if (btn) btn.click();
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h2 className="text-[34px] font-black tracking-tighter text-foreground">메뉴</h2>
      </div>`;

settingsContent = settingsContent.replace(titleOld, titleNew);

// Inject a hidden button in SettingsView to change tab back to Map
// Actually, it's better to pass a callback or just change state. But we don't have setActiveTab passed to SettingsView!
// Let's modify SettingsView props to accept `onBack`
const propsOld = /interface SettingsViewProps \{[\s\S]*?\}/;
const propsNew = `interface SettingsViewProps {
  theme: string;
  setTheme: (t: string) => void;
  colorTheme: string;
  setColorTheme: (t: string) => void;
  locationPerm: string;
  notifPerm: string;
  onReplayTutorial: () => void;
  onBack: () => void;
}`;
if (settingsContent.match(propsOld)) {
    settingsContent = settingsContent.replace(propsOld, propsNew);
} else {
    // If no interface, add it
}

const compOld = /export default function SettingsView\(\{ theme, setTheme, colorTheme, setColorTheme, locationPerm, notifPerm, onReplayTutorial \}: any\) \{/;
const compNew = `export default function SettingsView({ theme, setTheme, colorTheme, setColorTheme, locationPerm, notifPerm, onReplayTutorial, onBack }: any) {`;
settingsContent = settingsContent.replace(compOld, compNew);

settingsContent = settingsContent.replace(/const btn = document.getElementById\('back-to-map-btn'\);\s*if \(btn\) btn.click\(\);/, 'onBack();');

fs.writeFileSync('src/components/SettingsView.tsx', settingsContent);

// Fix page.tsx invocation of SettingsView
content = fs.readFileSync('src/app/page.tsx', 'utf-8');
const settingsCallOld = /<SettingsView\s*theme=\{theme\}\s*setTheme=\{setTheme\}\s*colorTheme=\{colorTheme\}\s*setColorTheme=\{handleColorThemeChange\}\s*locationPerm=\{locationPerm\}\s*notifPerm=\{notifPerm\}\s*onReplayTutorial=\{startTutorial\}\s*\/>/;
const settingsCallNew = `<SettingsView 
          theme={theme} 
          setTheme={setTheme} 
          colorTheme={colorTheme} 
          setColorTheme={handleColorThemeChange} 
          locationPerm={locationPerm} 
          notifPerm={notifPerm} 
          onReplayTutorial={startTutorial}
          onBack={() => setActiveTab('map')}
        />`;
content = content.replace(settingsCallOld, settingsCallNew);
fs.writeFileSync('src/app/page.tsx', content);

console.log("Patched user menu");
