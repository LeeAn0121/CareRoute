const fs = require('fs');
let code = fs.readFileSync('src/components/Tour.tsx', 'utf-8');

const targetNav = `      target: '#tour-bottom-nav',
      title: <><IconCategory className="text-primary" /> 주요 메뉴 이동</>,
      content: '하단 탭을 통해 언제든지 핵심 기능인 [지도], [명단 관리], [오늘의 경로] 화면으로 이동할 수 있습니다.',`;

const newNav = `      target: '#tour-bottom-nav',
      title: <><IconCategory className="text-primary" /> 주요 메뉴 이동</>,
      content: '하단 탭을 통해 언제든지 핵심 기능인 [지도], [명단 관리], [방문 일정] 화면으로 이동할 수 있습니다.',`;

code = code.replace(targetNav, newNav);

const targetMenu = `      target: '#tour-user-menu',
      title: <><IconMenu2 className="text-primary" /> 사용자 설정</>,
      content: '우측 상단의 메뉴 버튼을 누르면 앱 테마, 알림 등 세부 설정 창으로 들어갈 수 있습니다.',`;

const newMenu = `      target: '#tour-user-menu',
      title: <><IconMenu2 className="text-primary" /> 사용자 설정</>,
      content: '우측 상단 메뉴 버튼을 눌러 앱 테마를 바꾸거나 구글 캘린더 동기화 기능을 사용할 수 있습니다.',`;

code = code.replace(targetMenu, newMenu);

fs.writeFileSync('src/components/Tour.tsx', code);
