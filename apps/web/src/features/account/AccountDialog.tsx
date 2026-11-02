import { useEffect, useState } from 'react'
import { demoAccounts, saveProfile, type User } from '../auth/auth-api'
import { fetchMyBooks, setBookVisibility, updateBook, uploadBookImage } from '../books/book-api'
import { PublishBookDialog } from '../books/PublishBookDialog'
import { fetchReports, resolveReport, type ReportRecord } from '../reports/report-api'
import type { Book } from '../../types/books'
import './account.css'

type Tab = 'books' | 'reports' | 'admin'
type Props = {
  user: User | null; useApi: boolean; onClose: () => void
  onLogin: (id: string) => Promise<void>; onLogout: () => Promise<void>
  onProfile: (user: User) => void; onReservations: () => void
  onBooksChange: () => void
}
const statusNames: Record<Book['status'], string> = { available: '在售', reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' }

export function AccountDialog(props: Props) {
  const { user, useApi, onClose } = props
  const [accounts, setAccounts] = useState<Pick<User, 'id' | 'nickname' | 'role'>[]>([])
  const [tab, setTab] = useState<Tab>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Book | null>(null)
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [contact, setContact] = useState(user?.contact ?? '')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        if (!useApi) return
        if (!user) {
          const result = await demoAccounts()
          if (active) setAccounts(result)
        } else if (tab === 'books') {
          const result = await fetchMyBooks()
          if (active) setBooks(result)
        } else {
          const result = await fetchReports(tab === 'admin')
          if (active) setReports(result)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '读取失败')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [user, tab, revision, useApi])

  function reload() { setError(''); setLoading(true); setRevision((n) => n + 1) }
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试') }
    finally { setBusy(false) }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={() => { if (!busy) onClose() }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" disabled={busy} onClick={onClose} aria-label="关闭个人中心">×</button>
        <span className="section-kicker">我的书桥</span>
        <h2 id="account-title">{user ? user.nickname : '欢迎来到珞珈书桥'}</h2>
        {!user && <><p className="account-hint">比赛演示账号，各设备可分别选择一位同学登录。资料仅使用虚构数据。</p>{!useApi && <p>当前为离线界面预览。启动本机演示后可登录并保存数据。</p>}<div className="account-logins">{accounts.map((account) => <button disabled={busy} key={account.id} onClick={() => perform(() => props.onLogin(account.id))}><strong>{account.nickname}</strong><span>{account.role === 'admin' ? '管理员' : '同学账号'}</span></button>)}</div></>}
        {user && <>
          <div className="account-profile"><span>{user.college} · {user.role === 'admin' ? '管理员' : '同学'}</span><button disabled={busy} onClick={() => perform(props.onLogout)}>退出登录</button></div>
          <button className="primary-action" onClick={props.onReservations}>查看我的预约与交接 →</button>
          <details className="profile-editor"><summary>昵称与联系方式</summary><form onSubmit={(event) => { event.preventDefault(); void perform(async () => props.onProfile(await saveProfile(nickname, contact))) }}><label>昵称<input required maxLength={80} value={nickname} onChange={(event) => setNickname(event.target.value)} /></label><label>自愿提供的联系方式<input maxLength={200} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="例如演示微信号或约定方式" /></label><p className="account-hint">仅在卖家接受预约后向交易对方展示，清空即可停止分享。</p><button disabled={busy}>保存资料</button></form></details>
          <div className="account-tabs"><button aria-pressed={tab === 'books'} onClick={() => { setTab('books'); reload() }}>我的发布</button><button aria-pressed={tab === 'reports'} onClick={() => { setTab('reports'); reload() }}>我的反馈</button>{user.role === 'admin' && <button aria-pressed={tab === 'admin'} onClick={() => { setTab('admin'); reload() }}>处理举报</button>}</div>
          {!loading && tab === 'books' && <div className="account-list">{!books.length && <p>还没有发布书籍，点击底部“发布”添加第一本书。</p>}{books.map((book) => <article key={book.id}><div><h3>{book.title}</h3><span>{statusNames[book.status]} · ¥{book.price.toFixed(2)}</span></div>{['available', 'offline', 'draft'].includes(book.status) && <div className="account-actions"><button disabled={busy} onClick={() => setEditing(book)}>编辑</button><label>补传图片<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void perform(async () => { await uploadBookImage(book.id, file); props.onBooksChange() }); event.target.value = '' }} /></label><button disabled={busy} onClick={() => perform(async () => { await setBookVisibility(book.id, book.status === 'available' ? 'offline' : 'publish'); props.onBooksChange() })}>{book.status === 'available' ? '下架' : '重新发布'}</button></div>}</article>)}</div>}
          {!loading && tab !== 'books' && <div className="account-list">{!reports.length && <p>暂无反馈记录。</p>}{reports.map((report) => <ReportItem key={report.id} report={report} admin={tab === 'admin'} disabled={busy} onResolve={(resolution, status, outcome) => perform(() => resolveReport(report.id, resolution, status, outcome))} />)}</div>}
        </>}
        {loading && <p role="status">正在读取…</p>}
        {error && <div className="form-error" role="alert">{error}<button onClick={reload} disabled={busy}>重试</button></div>}
      </section>
      {editing && <PublishBookDialog initialBook={editing} onClose={() => setEditing(null)} onSubmit={async (book) => { await updateBook(book); setEditing(null); props.onBooksChange(); reload() }} />}
    </div>
  )
}

function ReportItem({ report, admin, disabled, onResolve }: { report: ReportRecord; admin: boolean; disabled: boolean; onResolve: (resolution: string, status: 'resolved' | 'rejected', outcome?: string) => Promise<void> }) {
  const [resolution, setResolution] = useState('')
  const [outcome, setOutcome] = useState('')
  const active = report.status === 'open' || report.status === 'processing'
  return <article><h3>{report.reason}</h3><p>{report.description}</p><small>{({ open: '待处理', processing: '处理中', resolved: '已处理', rejected: '已驳回' } as Record<string, string>)[report.status]}</small>{report.resolution && <p>处理结果 · {report.resolution}</p>}{admin && active && <form onSubmit={(event) => { event.preventDefault(); void onResolve(resolution, 'resolved', outcome || undefined) }}><label>核实说明<textarea required maxLength={2000} value={resolution} onChange={(event) => setResolution(event.target.value)} /></label>{report.targetType === 'reservation' && <label>争议处理<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">仅记录处理结果</option><option value="cancel">核实后取消交易</option><option value="complete">核实后完成交易</option></select></label>}<button disabled={disabled}>保存处理结果</button><button type="button" disabled={disabled || !resolution.trim()} onClick={() => onResolve(resolution, 'rejected')}>驳回反馈</button></form>}</article>
}
