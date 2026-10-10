const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add min-w-0 to the Card Content wrapper to prevent horizontal stretching
const oldCardWrapper = `                      {/* Card Content */}
                      <div className={\`flex-1 rounded-2xl border \${isNext ? 'border-primary shadow-md shadow-primary/10' : 'border-surface-border shadow-sm shadow-foreground/5'} bg-surface p-4 active:scale-[0.98] transition-transform\`}>`;

const newCardWrapper = `                      {/* Card Content */}
                      <div className={\`flex-1 min-w-0 rounded-2xl border \${isNext ? 'border-primary shadow-md shadow-primary/10' : 'border-surface-border shadow-sm shadow-foreground/5'} bg-surface p-4 active:scale-[0.98] transition-transform\`}>`;

code = code.replace(oldCardWrapper, newCardWrapper);

// 2. Make the buttons wrap nicely
const oldButtons = `                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }}
                            className={\`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition-colors \${completed ? 'bg-surface-muted text-foreground/60 hover:bg-surface-border' : 'bg-primary/10 text-primary hover:bg-primary/20'}\`}
                          >
                            <IconCheck size={16} />
                            {completed ? '완료 취소' : '방문 완료'}
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
                            onClick={(e) => { e.stopPropagation(); setManagingScheduleRecipient(marker); }}
                            className="flex-shrink-0 flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-bold bg-surface-muted text-foreground/70 hover:bg-surface-border transition-colors"
                          >
                            일정 관리
                          </button>
                          
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFromSchedule(marker, scheduleDate); }}
                            className="flex-shrink-0 flex items-center justify-center w-10 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            aria-label="일정에서 제외"
                          >
                            <IconX size={16} strokeWidth={3} />
                          </button>
                        </div>`;

const newButtons = `                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-1 gap-2 min-w-[140px]">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }}
                              className={\`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap \${completed ? 'bg-surface-muted text-foreground/60 hover:bg-surface-border' : 'bg-primary/10 text-primary hover:bg-primary/20'}\`}
                            >
                              <IconCheck size={16} />
                              {completed ? '완료 취소' : '방문 완료'}
                            </button>
                            
                            {!completed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity whitespace-nowrap"
                              >
                                <IconNavigation size={16} />
                                길안내
                              </button>
                            )}
                          </div>
                          
                          <div className="flex gap-2 min-w-fit flex-1 sm:flex-none justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setManagingScheduleRecipient(marker); }}
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-bold bg-surface-muted text-foreground/70 hover:bg-surface-border transition-colors whitespace-nowrap"
                            >
                              일정 관리
                            </button>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveFromSchedule(marker, scheduleDate); }}
                              className="flex-shrink-0 flex items-center justify-center w-10 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                              aria-label="일정에서 제외"
                            >
                              <IconX size={16} strokeWidth={3} />
                            </button>
                          </div>
                        </div>`;

code = code.replace(oldButtons, newButtons);

// Are there any other overflow elements?
// The timeline dot container:
// `className="relative pl-6 space-y-5 mt-4"`
// If the user's screen is really small, padding left 6 is 24px. The line is absolute.
// This is fine.

fs.writeFileSync('src/app/page.tsx', code);
console.log("Patched route card layout for mobile");
