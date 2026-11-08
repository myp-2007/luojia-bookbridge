import { useCallback, useState } from 'react'
import { Empty, ErrorNotice } from '../../components/ui'
import { useLiveRefresh } from '../../lib/use-live-refresh'
import { fetchReports, resolveReport, type ReportRecord } from './report-api'

export function ReportsPage({ admin = false }: { admin?: boolean }) {
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sync = useCallback(async (current: () => boolean) => { try { const result = await fetchReports(admin); if (current()) { setReports(result); setError('') } } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '读取反馈失败') } finally { if (current()) setLoading(false) } }, [admin])
  useLiveRefresh(sync, !busy, revision)
  async function resolve(id: string, resolution: string, status: 'resolved' | 'rejected', outcome: string) { setBusy(true); setError(''); try { await resolveReport(id, resolution, status, outcome || undefined); setRevision((n) => n + 1) } catch (cause) { setError(cause instanceof Error ? cause.message : '处理失败') } finally { setBusy(false) } }
  return <><p className="page-intro">{admin ? '核实双方提供的信息后处理反馈；涉及争议交易时请选择对应处理结果。' : '你提交的问题和处理结果会保存在这里。'}</p>{error && <ErrorNotice message={error} retry={() => setRevision((n) => n + 1)}/>}<div className="account-list">{reports.map((report) => <ReportRow key={report.id} report={report} admin={admin} busy={busy} onResolve={(resolution, status, outcome) => resolve(report.id, resolution, status, outcome)}/>)}</div>{loading && <p role="status">正在读取反馈…</p>}{!loading && !reports.length && !error && <Empty title="暂无反馈记录"/>}</>
}
function ReportRow({ report, admin, busy, onResolve }: { report: ReportRecord; admin: boolean; busy: boolean; onResolve: (resolution: string, status: 'resolved' | 'rejected', outcome: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState('')
  return <article className="form-card"><h3>{report.reason}</h3><p>{report.description}</p><span className="status-pill">{({ open: '待处理', processing: '处理中', resolved: '已处理', rejected: '已驳回' } as Record<string,string>)[report.status]}</span>{report.resolution && <p>处理结果 · {report.resolution}</p>}{admin && ['open','processing'].includes(report.status) && <form onSubmit={(event) => { event.preventDefault(); void onResolve(reason, 'resolved', outcome) }}><label>核实说明<textarea required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)}/></label>{report.targetType === 'reservation' && <label>争议处理<select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">仅记录处理结果</option><option value="cancel">核实后取消交易</option><option value="complete">核实后完成交易</option></select></label>}<div className="inline-actions"><button className="button primary" disabled={busy || !reason.trim()}>保存处理结果</button><button className="button secondary" type="button" disabled={busy || !reason.trim()} onClick={() => onResolve(reason, 'rejected', '')}>驳回反馈</button></div></form>}</article>
}
