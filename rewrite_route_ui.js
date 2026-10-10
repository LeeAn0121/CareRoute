const fs = require('fs');
let page = fs.readFileSync('src/app/page.tsx', 'utf-8');

const startIndex = page.indexOf("{activeTab === 'route' && (");
const endIndex = page.indexOf("{activeTab === 'settings' && (");

const newRouteUI = `{activeTab === 'route' && (
          <div className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-background flex flex-col">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-primary">
                  {scheduleDate.toDateString() === new Date().toDateString() ? '오늘의 ' : \`\${scheduleDate.getMonth() + 1}월 \${scheduleDate.getDate()}일 \`}
                  방문 일정
                </p>
                <p className="text-sm text-foreground/50 font-semibold">
                  총 {scheduleRoute.length}곳 방문 예정
                </p>
              </div>
              <Button
                variant="ghost"
                loading={isSyncingCalendar}
                onClick={handleSyncToCalendar}
                className="py-2 text-sm whitespace-nowrap"
              >
                구글 캘린더 동기화
              </Button>
            </div>

            {/* Horizontal Calendar Scroller */}
            <div className="flex overflow-x-auto gap-2 py-3 mb-2 scrollbar-hide snap-x">
              {Array.from({length: 30}, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - 15 + i);
                return d;
              }).map(date => {
                const isSelected = date.toDateString() === scheduleDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                const dayStr = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                return (
                  <div
                    key={date.getTime()}
                    onClick={() => setScheduleDate(date)}
                    className={\`flex flex-col items-center justify-center w-14 h-[72px] rounded-2xl flex-shrink-0 cursor-pointer snap-center transition-all \${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' : isToday ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface text-foreground/70 border border-surface-border active:scale-95'}\`}
                  >
                    <span className="text-[11px] font-bold mb-0.5 opacity-80">{dayStr}</span>
                    <span className="text-lg font-black">{date.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {scheduleRoute.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconCalendarEvent size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-foreground/60 mb-1">일정이 없습니다.</p>
                <p className="text-sm text-foreground/40">우측 하단 + 버튼을 눌러 어르신을 추가하세요.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 mt-4">
                {/* Vertical Timeline Line */}
                <div className="absolute top-4 bottom-8 left-[11px] w-[2px] bg-surface-border rounded-full" />
                
                {scheduleRoute.map((marker, i) => {
                  const completed = isCompletedForDate(marker, scheduleDate);
                  const isNext = !completed && (i === 0 || isCompletedForDate(scheduleRoute[i-1], scheduleDate));

                  return (
                    <div
                      key={marker.id}
                      onClick={() => setSelectedRecipient(marker)}
                      className={\`relative flex gap-4 items-start cursor-pointer transition-all \${completed ? 'opacity-60' : 'opacity-100'}\`}
                    >
                      {/* Timeline Dot */}
                      <div className={\`absolute -left-[24px] top-1.5 w-[24px] h-[24px] rounded-full flex items-center justify-center z-10 \${completed ? 'bg-surface-muted border-2 border-surface-border text-foreground/40' : (isNext ? 'bg-primary border-4 border-primary/20 text-primary-foreground shadow-lg shadow-primary/40' : 'bg-surface border-[3px] border-surface-border text-foreground/60')}\`}>
                        {completed ? <IconCheck size={14} strokeWidth={3} /> : <span className="text-[11px] font-black">{i + 1}</span>}
                      </div>
                      
                      {/* Card Content */}
                      <div className={\`flex-1 rounded-2xl border \${isNext ? 'border-primary shadow-md shadow-primary/10' : 'border-surface-border shadow-sm shadow-foreground/5'} bg-surface p-4 active:scale-[0.98] transition-transform\`}>
                        <div className="flex gap-3 items-start">
                          <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {marker.photo_url ? (
                              <img src={marker.photo_url} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <IconUser size={24} color='var(--primary)' />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={\`font-black text-lg text-primary tracking-tight truncate \${completed ? 'line-through opacity-80' : ''}\`}>{marker.name}</p>
                              {isNext && <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-black rounded-full animate-pulse shadow-sm">NEXT</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-foreground/60">
                              <IconClock size={14} className={isNext ? 'text-accent' : ''} />
                              <span className={isNext ? 'text-accent' : ''}>
                                {marker.visit_time && marker.visit_time !== '00:00:00' ? marker.visit_time.substring(0, 5) : '시간 미정'}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/60 font-medium truncate">
                              {marker.address}{marker.detail_address ? \` \${marker.detail_address}\` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* FAB for adding to schedule */}
            <button
              onClick={() => setIsScheduleAddOpen(true)}
              className="fixed bottom-[100px] right-5 z-40 w-[60px] h-[60px] flex items-center justify-center rounded-[24px] shadow-[0_16px_32px_rgba(var(--primary),0.35)] bg-primary text-primary-foreground border border-white/20 transition-transform active:scale-90 backdrop-blur-[40px] saturate-200"
            >
              <IconPlus size={32} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
      
      `;

page = page.slice(0, startIndex) + newRouteUI + page.slice(endIndex);
fs.writeFileSync('src/app/page.tsx', page);
console.log("Replaced route tab UI.");
