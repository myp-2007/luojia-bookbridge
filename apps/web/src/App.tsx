import { useMemo, useState } from 'react'
import './App.css'
import { mockBooks } from './data/mock-books'
import type { Book } from './types/books'

type Category = 'all' | 'textbook' | 'reading' | 'donation'

const categoryLabels: Record<Category, string> = {
  all: '全部',
  textbook: '教材交易',
  reading: '课外读物',
  donation: '公益捐赠',
}

function App() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [activeTab, setActiveTab] = useState('首页')

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return mockBooks.filter((book) => {
      const matchesCategory = category === 'all' || book.category === category
      const matchesQuery =
        !normalizedQuery ||
        [book.title, book.author, book.publisher, ...book.tags]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">珞珈书桥 · 校园图书循环共享</p>
          <h1>一本书，连接更多珞珈人</h1>
        </div>
        <button className="icon-button" aria-label="查看消息">♧</button>
      </header>

      <main>
        <section className="hero-card">
          <div className="hero-copy">
            <span className="hero-kicker">AI 辅助检索</span>
            <h2>让闲置的书，继续被需要</h2>
            <p>按书名、课程或出版社寻找合适的二手书，在线预约后在校内公共地点完成交接。</p>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <span>书</span><i /><i /><i />
          </div>
        </section>

        <section className="search-section" aria-label="搜索图书">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索书名、课程、出版社..."
            />
            {query && <button className="clear-button" onClick={() => setQuery('')} aria-label="清除搜索">×</button>}
          </label>
          <div className="quick-tags" aria-label="快捷搜索">
            {['高等数学', 'C 语言', '考研资料'].map((tag) => (
              <button key={tag} onClick={() => setQuery(tag)}>{tag}</button>
            ))}
          </div>
        </section>

        <section className="feature-grid" aria-label="平台功能">
          <FeatureCard icon="▣" title="教材交易" description="专业教材，低价流转" tone="blue" />
          <FeatureCard icon="☰" title="课外交流" description="拓展阅读，分享好书" tone="green" />
          <FeatureCard icon="♡" title="公益捐赠" description="让书籍去更需要的地方" tone="gold" />
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div><p className="section-kicker">为你推荐</p><h2>校内热门书籍</h2></div>
            <button className="text-button" onClick={() => setCategory('all')}>查看全部 <span>→</span></button>
          </div>
          <div className="category-tabs" role="tablist" aria-label="书籍分类">
            {(Object.keys(categoryLabels) as Category[]).map((item) => (
              <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
                {categoryLabels[item]}
              </button>
            ))}
          </div>
          <div className="book-grid">
            {filteredBooks.length ? filteredBooks.map((book) => <BookCard key={book.id} book={book} />) : (
              <div className="empty-state"><span>⌕</span><strong>还没有找到合适的书</strong><p>试试换一个关键词，或者先浏览全部书籍。</p></div>
            )}
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        {['首页', '发现', '发布', '消息', '我的'].map((item) => (
          <button key={item} className={activeTab === item ? 'active' : ''} onClick={() => setActiveTab(item)}>
            <span className="nav-icon">{item === '发布' ? '+' : item === '首页' ? '⌂' : '◦'}</span><span>{item}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function FeatureCard({ icon, title, description, tone }: { icon: string; title: string; description: string; tone: 'blue' | 'green' | 'gold' }) {
  return <button className={`feature-card ${tone}`} onClick={() => undefined}><span className="feature-icon">{icon}</span><strong>{title}</strong><small>{description}</small></button>
}

function BookCard({ book }: { book: Book }) {
  return (
    <article className="book-card">
      <div className="book-cover" style={{ background: book.coverColor }} aria-label={`${book.title}封面`}><span>{book.coverText}</span></div>
      <div className="book-info">
        <div className="book-title-row"><h3>{book.title}</h3><span className="distance">{book.distance}</span></div>
        <p className="book-meta">{book.edition} · {book.condition}</p>
        <div className="book-tags">{book.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="book-bottom-row"><strong className="price">¥{book.price}</strong><span className="location">⌖ {book.pickupPoint}</span></div>
      </div>
    </article>
  )
}

export default App
