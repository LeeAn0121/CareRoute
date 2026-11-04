// 방문 시작~종료까지 실제 머문 시간 기록. 완료 처리 시, 시작 시각이 있었던 경우에만
// 기록 실패는 조용히 콘솔에만 남기고 완료 처리 자체는 끊기지 않게 한다.
import { saveVisitLog } from './pendingVisitLogs';

export async function logVisitDuration(params: {
  recipientId: string;
  recipientName: string;
  startedAt: string;
  endedAt: string;
}) {
  try {
    const saved = await saveVisitLog('visit_logs', {
      recipient_id: params.recipientId,
      recipient_name: params.recipientName,
      started_at: params.startedAt,
      ended_at: params.endedAt,
    });
    return saved;
  } catch (e) {
    console.error('visit log insert failed', e);
  }
}
