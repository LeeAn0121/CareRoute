// 어르신 정보 출력 화면을 PDF로 저장할 때 쓰는 공통 캡처/배치 로직.
// html2canvas로 .print-sheet 한 장을 이미지로 찍고, jsPDF로 A4 페이지에 맞춰 넣는다.
import type { jsPDF } from 'jspdf';

export async function captureSheetCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default;
  return html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    onclone: (_doc, cloned) => {
      cloned.classList.add('pdf-export-capture');
    },
  });
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// 캔버스를 가로세로 비율을 유지한 채 A4 한 페이지에 맞춰 추가한다(찌그러짐 방지).
export function addCanvasAsA4Page(pdf: jsPDF, canvas: HTMLCanvasElement, isFirstPage: boolean) {
  if (!isFirstPage) pdf.addPage();

  const ratio = canvas.width / canvas.height;
  let width = A4_WIDTH_MM;
  let height = width / ratio;
  if (height > A4_HEIGHT_MM) {
    height = A4_HEIGHT_MM;
    width = height * ratio;
  }
  const x = (A4_WIDTH_MM - width) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, 0, width, height);
}

export async function createA4Pdf(): Promise<jsPDF> {
  const { default: JsPdf } = await import('jspdf');
  return new JsPdf({ unit: 'mm', format: 'a4' });
}
