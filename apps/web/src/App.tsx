import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useLiveRefresh } from './lib/use-live-refresh'
import { BookCard } from './features/books/BookCard'
import { BookDetailDialog } from './features/books/BookDetailDialog'
import { BookFilterForm } from './features/books/BookFilterForm'
import { PublishBookDialog } from './features/books/PublishBookDialog'
import { createBook, createReservation, DEFAULT_BOOK_FILTERS, fetchBooks, uploadBookImage, type BookFilters } from './features/books/book-api'
import { AIRecognitionDialog } from './features/ai/AIRecognitionDialog'
import { MyReservationsDialog } from './features/reservations/MyReservationsDialog'
import { ReportDialog } from './features/reports/ReportDialog'
import { createReport } from './features/reports/report-api'
import { mockBooks } from './data/mock-books'
import { AccountDialog } from './features/account/AccountDialog'
import { getMe, login, logout, setSignedInId, type User } from './features/auth/auth-api'
import type { Book } from './types/books'

type Category = 'all' | 'textbook' | 'reading' | 'donation'

const categoryLabels: Record<Category, string> = { all: '全部', textbook: '教材交易', reading: '课外读物', donation: '免费赠书' }

function App() {
  const [books, setBooks] = useState<Book[]>(import.meta.env.VITE_USE_API === 'false' ? mockBooks : [])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<BookFilters>(DEFAULT_BOOK_FILTERS)
  const [page, setPage] = useState(1)
  const [catalogMeta, setCatalogMeta] = useState({ total: 0, pageSize: 12 })
  const [category, setCategory] = useState<Category>('all')
  const [activeTab, setActiveTab] = useState('首页')
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [showReservations, setShowReservations] = useState(false)
  const [reportBookId, setReportBookId] = useState<string | null>(null)
  const [aiBookId, setAiBookId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(import.meta.env.VITE_USE_API !== 'false')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [reserving, setReserving] = useState(false)
  const reserveLock = useRef(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const useApi = import.meta.env.VITE_USE_API !== 'false'
  const [user, setUser] = useState<User | null>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [catalogRevision, setCatalogRevision] = useState(0)

  useEffect(() => {
    if (!useApi) return
    let active = true
    getMe().then((current) => {
      if (active) { setUser(current); setSignedInId(current.id) }
    }).catch(() => undefined)
    const expired = () => { setUser(null); setSignedInId('') }
    window.addEventListener('session-expired', expired)
    return () => { active = false; window.removeEventListener('session-expired', expired) }
  }, [useApi])

  function needLogin(action: () => void) {
    if (useApi && !user) { setShowAccount(true); return }
    action()
  }
  function refreshBooks() { setCatalogRevision((value) => value + 1) }


  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null

  const syncCatalog = useCallback(async (isCurrent: () => boolean) => {
    try {
      const result = await fetchBooks(query.trim(), category, filters, page)
      if (isCurrent()) {
        const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setBooks(result.items)
        setCatalogMeta({ total: result.total, pageSize: result.pageSize })
        setApiError(null)
        setLastSync(new Date().toLocaleTimeString('zh-CN'))
      }
    } catch {
      if (isCurrent()) setApiError('暂时无法连接主机，保留上次读取的内容，连接恢复后会自动重试。')
    } finally {
      if (isCurrent()) setCatalogLoading(false)
    }
  }, [category, query, filters, page])

  useLiveRefresh(syncCatalog, useApi && !reserving && !showPublish && !showAccount && !showReservations && !aiBookId && !reportBookId, catalogRevision)


  const filteredBooks = useMemo(() => {
    if (useApi) return books
    const normalizedQuery = query.trim().toLowerCase()
    return books.filter((book) => {
      const matchesCategory = category === 'all' || book.category === category
      const matchesQuery = !normalizedQuery || [book.title, book.author, book.publisher, ...book.tags].join(' ').toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [books, category, query, useApi])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const reserveBook = async () => {
    if (!selectedBook || reserveLock.current) return
    if (useApi && !user) { setShowAccount(true); return }
    reserveLock.current = true
    setReserving(true)
    try {
      if (useApi) await createReservation(selectedBook.id, selectedBook.pickupPoint)
      setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, status: 'reserved' } : book))
      setSelectedBookId(null)
      notify('预约已提交，等待卖家确认')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : '预约失败，请重试')
      refreshBooks()
    } finally {
      reserveLock.current = false
      setReserving(false)
    }
  }

  const publishBook = async (book: Book, imageFile?: File) => {
    const savedBook = useApi ? await createBook(book) : book
    let imageWarning = false
    if (useApi && imageFile) {
      try { await uploadBookImage(savedBook.id, imageFile) } catch { imageWarning = true }
    }
    setShowPublish(false)
    if (useApi) {
      setPage(1)
      refreshBooks()
    } else {
      setBooks((current) => [savedBook, ...current])
    }
    notify(imageWarning ? '书籍已发布，图片上传失败。请稍后补传封面' : useApi ? '书籍已发布到校园书架' : '书籍已保存到本地演示列表')
  }

  const submitReport = async (reason: string, description: string) => {
    if (useApi && reportBookId) await createReport(reportBookId, reason, description)
    setReportBookId(null)
    setSelectedBookId(null)
    notify(useApi ? '反馈已提交，项目人员会尽快核实' : '反馈已记录到本地演示流程')
  }

  function chooseCategory(next: Category) {
    setCategory(next)
    setPage(1)
  }

  function changeQuery(next: string) {
    setQuery(next)
    setPage(1)
  }

  function applyFilters(next: BookFilters) {
    setFilters(next)
    setPage(1)
  }

  const pageCount = Math.max(1, Math.ceil(catalogMeta.total / catalogMeta.pageSize))
  const selectFeature = (nextCategory: Category) => {
    chooseCategory(nextCategory)
    document.querySelector('.section-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">珞珈书桥 · 校园图书循环共享</p><h1>一本书，连接更多珞珈人</h1></div>
        <button className="icon-button" onClick={() => needLogin(() => setShowReservations(true))} aria-label="查看预约进度">♧</button>
      </header>

      <main>
        <section className="hero-card">
          <div className="hero-copy"><span className="hero-kicker">AI 辅助识别</span><h2>让闲置的书，继续被需要</h2><p>按书名、作者或出版社寻找合适的二手书，在线预约后在校内公共地点完成交接。</p></div>
          <div className="hero-orbit" aria-hidden="true"><span>书</span><i /><i /><i /></div>
        </section>

        <section className="search-section" aria-label="搜索图书">
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} maxLength={100} onChange={(event) => changeQuery(event.target.value)} placeholder="搜索书名、作者、出版社..." />{query && <button className="clear-button" onClick={() => changeQuery('')} aria-label="清除搜索">×</button>}</label>
          <div className="quick-tags" aria-label="快捷搜索">{['高等数学', 'C 语言', '考研资料'].map((tag) => <button key={tag} onClick={() => changeQuery(tag)}>{tag}</button>)}</div>
        </section>

        <section className="feature-grid" aria-label="平台功能">
          <FeatureCard icon="▣" title="教材交易" description="专业教材，低价流转" tone="blue" onClick={() => selectFeature('textbook')} />
          <FeatureCard icon="☰" title="课外读物" description="拓展阅读，分享好书" tone="green" onClick={() => selectFeature('reading')} />
          <FeatureCard icon="♡" title="免费赠书" description="把闲置好书送给下一位同学" tone="gold" onClick={() => selectFeature('donation')} />
        </section>

        <section className="section-block">
          <div className="section-heading"><div><p className="section-kicker">为你推荐</p><h2>校园共享书架</h2></div><button className="text-button" onClick={() => { chooseCategory('all'); changeQuery(''); applyFilters(DEFAULT_BOOK_FILTERS) }}>查看全部 <span>→</span></button></div>
          <div className="category-tabs" role="tablist" aria-label="书籍分类">{(Object.keys(categoryLabels) as Category[]).map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => chooseCategory(item)}>{categoryLabels[item]}</button>)}</div>
          {useApi && <details className="catalog-filters"><summary>筛选与排序</summary><BookFilterForm key={JSON.stringify(filters)} filters={filters} onApply={applyFilters} /></details>}
          {useApi && <div className="live-status"><span>{catalogLoading ? '正在读取共享书架…' : apiError ? '连接暂不可用' : '共享书架 · 每5秒同步'}{lastSync && ` · 上次更新 ${lastSync}`}</span><button disabled={catalogLoading} onClick={refreshBooks}>刷新书架</button></div>}
          {apiError && <p className="api-notice" role="alert">{apiError} <button onClick={refreshBooks}>重试</button></p>}
          <div className="book-grid">{catalogLoading ? <p role="status">正在读取书籍…</p> : filteredBooks.length ? filteredBooks.map((book) => <BookCard key={book.id} book={book} onOpen={setSelectedBookId.bind(null, book.id)} />) : apiError ? null : <div className="empty-state"><span>⌕</span><strong>还没有找到合适的书</strong><p>试试换一个关键词，或者先浏览全部书籍。</p></div>}</div>
          {useApi && !catalogLoading && catalogMeta.total > 0 && <nav className="catalog-pagination" aria-label="书架分页">
            <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</button>
            <span>第 {page} / {pageCount} 页 · 共 {catalogMeta.total} 本</span>
            <button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</button>
          </nav>}
        </section>
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        {['首页', '发现', '发布', '记录', '我的'].map((item) => <button key={item} className={activeTab === item ? 'active' : ''} onClick={() => item === '发布' ? needLogin(() => setShowPublish(true)) : item === '我的' ? setShowAccount(true) : item === '记录' ? needLogin(() => setShowReservations(true)) : (setActiveTab(item), item === '发现' && document.querySelector('.search-section')?.scrollIntoView({ behavior: 'smooth' }))}><span className="nav-icon">{item === '发布' ? '+' : item === '首页' ? '⌂' : '◦'}</span><span>{item}</span></button>)}
      </nav>

      {selectedBook && <BookDetailDialog book={selectedBook} reserving={reserving} onClose={() => setSelectedBookId(null)} onReserve={reserveBook} onReport={() => needLogin(() => setReportBookId(selectedBook.id))} onRecognize={() => setAiBookId(selectedBook.id)} />}
      {showPublish && <PublishBookDialog onClose={() => setShowPublish(false)} onSubmit={publishBook} />}
      {showAccount && <AccountDialog key={user?.id ?? 'anonymous'} user={user} useApi={useApi} onClose={() => setShowAccount(false)} onLogin={async (id) => { const current = await login(id); setSignedInId(current.id); setUser(current); refreshBooks() }} onLogout={async () => { await logout(); setSignedInId(''); setUser(null); setShowReservations(false) }} onProfile={setUser} onReservations={() => { setShowAccount(false); setShowReservations(true) }} onBooksChange={refreshBooks} />}
      {showReservations && <MyReservationsDialog useApi={useApi} onClose={() => setShowReservations(false)} onNotice={notify} onBookStatusChange={(bookId, status) => setBooks((current) => current.map((book) => book.id === bookId ? { ...book, status } : book))} />}
      {reportBookId && <ReportDialog onClose={() => setReportBookId(null)} onSubmit={submitReport} />}
      {aiBookId && <AIRecognitionDialog book={books.find((book) => book.id === aiBookId) ?? mockBooks[0]} useApi={useApi} onApplied={refreshBooks} onClose={() => setAiBookId(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function FeatureCard({ icon, title, description, tone, onClick }: { icon: string; title: string; description: string; tone: 'blue' | 'green' | 'gold'; onClick: () => void }) {
  return <button className={`feature-card ${tone}`} onClick={onClick}><span className="feature-icon">{icon}</span><strong>{title}</strong><small>{description}</small></button>
}

export default App
