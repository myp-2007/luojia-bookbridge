import { useCallback, useState } from 'react'
import { apiRequest } from '../../lib/api-client'
import { useLiveRefresh } from '../../lib/use-live-refresh'
import type { Book } from '../../types/books'
import { fetchAdminBooks, moderateBook } from '../books/book-api'

interface AuditLog { id: string; actorId: string; action: string; targetId: string; description: string; createdAt: string }
const statuses: Record<Book['status'], string> = { available: '在售', reserved: '预约中', offline: '已下架', draft: '草稿', completed: '已完成' }
const actions: Record<string, string> = { suspend_book: '限制书籍', restore_book: '解除限制', resolve_report: '处理反馈' }

export function AdminWorkspace({ onChanged }: { onChanged: () => void }) {
  const [view, setView] = useState<'books' | 'audit'>('books')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [suspended, setSuspended] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [books, setBooks] = useState<Book[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sync = useCallback(async (isCurrent: () => boolean) => {
    try {
      const result = view === 'books' ? await fetchAdminBooks(query, suspended, page)
        : await apiRequest<{ items: AuditLog[]; total: number }>(`/admin/audit-logs?page=${page}&page_size=10`)
      if (isCurrent()) {
        const maxPage = Math.max(1, Math.ceil(result.total / 10))
        if (page > maxPage) { setPage(maxPage); return }
        if (view === 'books') setBooks(result.items as Book[])
        else setLogs(result.items as AuditLog[])
        setTotal(result.total); setError('')
      }
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : '管理数据读取失败') }
    finally { if (isCurrent()) setLoading(false) }
  }, [query, suspended, page, view])
  useLiveRefresh(sync, !busy, revision)

  async function moderate(book: Book, reason: string) {
    if (busy) return
    setBusy(true); setError('')
    try { await moderateBook(book.id, !book.isSuspended, reason); onChanged(); setRevision((n) => n + 1) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '处理失败') }
    finally { setBusy(false) }
  }
  return <div className="admin-workspace">
    <div className="account-tabs"><button disabled={busy} aria-pressed={view === 'books'} onClick={() => { setView('books'); setPage(1) }}>书籍审核</button><button disabled={busy} aria-pressed={view === 'audit'} onClick={() => { setView('audit'); setPage(1) }}>操作记录</button></div>
    {view === 'books' && <><p className="account-hint">限制后从书架隐藏，已有交易继续保留。解除后由发布者重新上架。处理说明会向发布者展示。</p><form className="admin-search" onSubmit={(event) => { event.preventDefault(); setQuery(draft); setPage(1); setRevision((n) => n + 1) }}>
      <label>查找书籍<input maxLength={100} placeholder="书名、作者或发布者ID" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      <label>管理状态<select disabled={busy} value={suspended} onChange={(event) => { setSuspended(event.target.value); setPage(1) }}><option value="">全部书籍</option><option value="true">管理限制中</option><option value="false">未限制</option></select></label><button disabled={busy}>搜索书籍</button>
    </form></>}
    {loading && <p role="status">正在读取管理数据…</p>}
    {error && <p className="form-error" role="alert">{error} <button disabled={busy} onClick={() => setRevision((n) => n + 1)}>刷新管理数据</button></p>}
    <div className="account-list">{view === 'books' ? books.map((book) => <ModerationItem key={book.id} book={book} busy={busy} onSubmit={(reason) => moderate(book, reason)} />)
      : logs.map((log) => <article key={log.id}><h3>{actions[log.action] ?? log.action}</h3><p>{log.description}</p><small>{log.actorId} · {new Date(log.createdAt).toLocaleString('zh-CN')}</small><p className="admin-id">对象 {log.targetId}</p></article>)}</div>
    {!loading && !total && <p>暂无符合条件的记录。</p>}
    <nav className="catalog-pagination" aria-label="管理列表分页"><button disabled={busy || page <= 1} onClick={() => setPage((n) => n - 1)}>上一页</button><span>{page} / {Math.max(1, Math.ceil(total / 10))} · 共 {total} 条</span><button disabled={busy || page >= Math.ceil(total / 10)} onClick={() => setPage((n) => n + 1)}>下一页</button></nav>
  </div>
}

function ModerationItem({ book, busy, onSubmit }: { book: Book; busy: boolean; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  return <article><div className="admin-book-heading">{book.coverUrl && <img src={book.coverUrl} alt="" />}<div><h3>{book.title}</h3><span>{statuses[book.status]} · {book.isSuspended ? '管理限制中' : '未限制'}</span><p className="admin-id">发布者 {book.sellerId}</p></div></div>
    {book.moderationReason && <p>最近处理 · {book.moderationReason}</p>}
    <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(reason.trim()) }}><label>处理说明<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="请填写核实结果和原因" /></label><button disabled={busy || !reason.trim()}>{book.isSuspended ? '解除书籍限制' : '限制书籍展示'}</button></form>
  </article>
}
