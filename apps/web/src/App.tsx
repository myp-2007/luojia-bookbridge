import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { BookCard } from './features/books/BookCard'
import { BookDetailDialog } from './features/books/BookDetailDialog'
import { PublishBookDialog } from './features/books/PublishBookDialog'
import { fetchBooks } from './features/books/book-api'
import { mockBooks } from './data/mock-books'
import type { Book } from './types/books'

type Category = 'all' | 'textbook' | 'reading' | 'donation'

const categoryLabels: Record<Category, string> = { all: '全部', textbook: '教材交易', reading: '课外读物', donation: '公益捐赠' }

function App() {
  const [books, setBooks] = useState<Book[]>(mockBooks)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [activeTab, setActiveTab] = useState('首页')
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isLoadingBooks, setIsLoadingBooks] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const useApi = import.meta.env.VITE_USE_API === 'true'

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null

  useEffect(() => {
    if (!useApi) return
    let active = true
    setIsLoadingBooks(true)
    fetchBooks(query.trim() || undefined, category === 'all' ? undefined : category)
      .then((items) => { if (active) { setBooks(items); setApiError(null) } })
      .catch(() => { if (active) setApiError('暂时无法连接服务器，当前显示本地演示数据') })
      .finally(() => { if (active) setIsLoadingBooks(false) })
    return () => { active = false }
  }, [category, query, useApi])

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return books.filter((book) => {
      const matchesCategory = category === 'all' || book.category === category
      const matchesQuery = !normalizedQuery || [book.title, book.author, book.publisher, ...book.tags].join(' ').toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [books, category, query])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const reserveBook = () => {
    if (!selectedBook) return
    setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, status: 'reserved' } : book))
    setSelectedBookId(null)
    notify('预约已提交，等待卖家确认')
  }

  const publishBook = (book: Book) => {
    setBooks((current) => [book, ...current])
    setShowPublish(false)
    notify('书籍已保存到本地演示列表')
  }

  const selectFeature = (nextCategory: Category) => {
    setCategory(nextCategory)
    document.querySelector('.section-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">珞珈书桥 · 校园图书循环共享</p><h1>一本书，连接更多珞珈人</h1></div>
        <button className="icon-button" onClick={() => notify('消息中心将在后端接口接入后开放')} aria-label="查看消息">♧</button>
      </header>

      <main>
        <section className="hero-card">
          <div className="hero-copy"><span className="hero-kicker">AI 辅助检索</span><h2>让闲置的书，继续被需要</h2><p>按书名、课程或出版社寻找合适的二手书，在线预约后在校内公共地点完成交接。</p></div>
          <div className="hero-orbit" aria-hidden="true"><span>书</span><i /><i /><i /></div>
        </section>

        <section className="search-section" aria-label="搜索图书">
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名、课程、出版社..." />{query && <button className="clear-button" onClick={() => setQuery('')} aria-label="清除搜索">×</button>}</label>
          <div className="quick-tags" aria-label="快捷搜索">{['高等数学', 'C 语言', '考研资料'].map((tag) => <button key={tag} onClick={() => setQuery(tag)}>{tag}</button>)}</div>
        </section>

        <section className="feature-grid" aria-label="平台功能">
          <FeatureCard icon="▣" title="教材交易" description="专业教材，低价流转" tone="blue" onClick={() => selectFeature('textbook')} />
          <FeatureCard icon="☰" title="课外交流" description="拓展阅读，分享好书" tone="green" onClick={() => selectFeature('reading')} />
          <FeatureCard icon="♡" title="公益捐赠" description="让书籍去更需要的地方" tone="gold" onClick={() => notify('公益捐赠模块将在交易闭环后接入')} />
        </section>

        <section className="section-block">
          <div className="section-heading"><div><p className="section-kicker">为你推荐</p><h2>校内热门书籍</h2></div><button className="text-button" onClick={() => setCategory('all')}>查看全部 <span>→</span></button></div>
          <div className="category-tabs" role="tablist" aria-label="书籍分类">{(Object.keys(categoryLabels) as Category[]).map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{categoryLabels[item]}</button>)}</div>
          {apiError && <p className="api-notice">{apiError}</p>}
          {isLoadingBooks && <p className="api-notice">正在从书架获取最新书籍...</p>}
          <div className="book-grid">{filteredBooks.length ? filteredBooks.map((book) => <BookCard key={book.id} book={book} onOpen={setSelectedBookId.bind(null, book.id)} />) : <div className="empty-state"><span>⌕</span><strong>还没有找到合适的书</strong><p>试试换一个关键词，或者先浏览全部书籍。</p></div>}</div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        {['首页', '发现', '发布', '消息', '我的'].map((item) => <button key={item} className={activeTab === item ? 'active' : ''} onClick={() => item === '发布' ? setShowPublish(true) : (setActiveTab(item), item !== '首页' && notify(`${item}模块正在完善中`))}><span className="nav-icon">{item === '发布' ? '+' : item === '首页' ? '⌂' : '◦'}</span><span>{item}</span></button>)}
      </nav>

      {selectedBook && <BookDetailDialog book={selectedBook} onClose={() => setSelectedBookId(null)} onReserve={reserveBook} />}
      {showPublish && <PublishBookDialog onClose={() => setShowPublish(false)} onSubmit={publishBook} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function FeatureCard({ icon, title, description, tone, onClick }: { icon: string; title: string; description: string; tone: 'blue' | 'green' | 'gold'; onClick: () => void }) {
  return <button className={`feature-card ${tone}`} onClick={onClick}><span className="feature-icon">{icon}</span><strong>{title}</strong><small>{description}</small></button>
}

export default App
