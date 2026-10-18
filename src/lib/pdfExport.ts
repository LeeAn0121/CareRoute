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

// 캔버스를 A4 폭(210mm) 가득 채워 넣는다. 예전에는 비율을 유지한 채 한 페이지 안에
// 전부 욱여넣다 보니, 내용이 한 장보다 길어지면(방문 정보/주소 등이 늘어난 경우) 세로를
// 기준으로 축소되면서 좌우에 여백이 남아 "A4를 꽉 채우지 못하는" 문제가 있었다.
// 이제는 항상 폭을 꽉 채우고, 한 페이지(297mm) 높이를 넘는 내용은 인쇄(@media print)의
// 여러 장 분할과 똑같이 페이지 높이만큼씩 잘라 다음 장에 이어 찍는다.
export function addCanvasAsA4Page(pdf: jsPDF, canvas: HTMLCanvasElement, isFirstPage: boolean) {
  const pxPerMm = canvas.width / A4_WIDTH_MM;
  const pageHeightPx = Math.round(A4_HEIGHT_MM * pxPerMm);

  let offsetPx = 0;
  let isFirstSlice = true;
  while (offsetPx < canvas.height) {
    if (!isFirstPage || !isFirstSlice) pdf.addPage();
    isFirstSlice = false;

    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - offsetPx);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      const sliceHeightMm = sliceHeightPx / pxPerMm;
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, A4_WIDTH_MM, sliceHeightMm);
    }
    offsetPx += sliceHeightPx;
  }
}

export async function createA4Pdf(): Promise<jsPDF> {
  const { default: JsPdf } = await import('jspdf');
  return new JsPdf({ unit: 'mm', format: 'a4' });
}
