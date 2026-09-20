'use client';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  typography: {
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif',
  },
  palette: {
    primary: {
      main: '#F5A524', // amber — 저장/등록/CTA 액션 컬러
      contrastText: '#12203D',
    },
    secondary: {
      main: '#12203D', // 잉크 네이비 — 구조(헤더/내비/텍스트)
    },
    success: {
      main: '#4C7A6B', // 세이지 그린
    },
    error: {
      main: '#D8493C',
    },
    background: {
      default: '#FBFAF7', // 페이퍼 화이트
    },
    text: {
      primary: '#12203D',
      secondary: '#5B6B82',
    },
  },
  shape: {
    borderRadius: 2,
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
