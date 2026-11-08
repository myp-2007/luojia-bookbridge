import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Avatar, Empty, ErrorNotice, Icon, Pagination } from '../../components/ui'
import { navigate } from '../../lib/router'
import { Link } from '../../components/Link'
import { useLiveRefresh } from '../../lib/use-live-refresh'
import { useSession } from '../auth/session'
import { fetchPublicUser, type PublicUser } from '../auth/auth-api'
import { BookCard } from './BookCard'
import { BookFilterForm } from './BookFilterForm'
import { DEFAULT_BOOK_FILTERS, fetchBooks, fetchPersonalBooks, setBookVisibility, type BookFilters } from './book-api'
import type { Book } from '../../types/books'
import campus from '../../assets/campus.jpg'

export function SearchBar({ value = '', onSearch }: { value?: string; onSearch: (query: string) => void }) {
  const [query, setQuery] = useState(value)
  function submit(event: FormEvent) { event.preventDefault(); onSearch(query.trim()) }
  return <form className="search-bar" role="search" onSubmit={submit}><Icon name="search" size={19}/><input type="search" value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="搜索书名、作者、出版社或ISBN" aria-label="搜索书籍"/><button type="submit">搜索</button></form>
}

export function HomePage() {
  const { user } = useSession()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sync = useCallback(async (current: () => boolean) => {
    try { const result = await fetchBooks('', 'all', DEFAULT_BOOK_FILTERS, 1); if (current()) { setBooks(result.items); setError('') } }
    catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '读取书架失败') }
    finally { if (current()) setLoading(false) }
  }, [])
  useLiveRefresh(sync, true, revision)
  return <><header className="home-header"><Link className="brand" to="/"><span>珞珈书桥<i/></span><small>让好书在校园继续发光</small></Link><Link className="home-account" to={user ? '/me' : '/login'} aria-label={user ? '打开个人中心' : '登录账号'}>{user ? <Avatar url={user.avatarUrl} name={user.nickname}/> : <Icon name="user"/>}</Link></header><SearchBar onSearch={(q) => navigate('/discover?q=' + encodeURIComponent(q))}/>
    <section className="campus-hero"><img src={campus} alt="武汉大学老斋舍前的樱花"/><div><span>在校园里，让知识流转</span><h1>一本书，<br/>连接更多珞珈人</h1><p>读过的好书，值得下一次相遇。</p><Link to="/publish">分享我的书 <Icon name="arrow" size={15}/></Link></div></section>
    <nav className="feature-links" aria-label="书籍分类">{[{ category: 'textbook', icon: 'book', label: '教材交易', text: '专业教材，低价流转', color: 'blue' }, { category: 'reading', icon: 'records', label: '课外读物', text: '拓展阅读，分享好书', color: 'green' }, { category: 'donation', icon: 'heart', label: '免费赠书', text: '把书送给需要的人', color: 'orange' }].map((item) => <Link key={item.category} to={'/discover?category=' + item.category}><span className={`feature-icon ${item.color}`}><Icon name={item.icon} size={25}/></span><strong>{item.label}</strong><small>{item.text}</small></Link>)}</nav>
    <section className="shelf-section"><div className="section-heading"><h2><span className="green-dot"/>校园新上架</h2><Link to="/discover">查看全部 <Icon name="arrow" size={15}/></Link></div>{error && <ErrorNotice message={error} retry={() => setRevision((n) => n + 1)}/>}<div className="book-grid">{books.map((book) => <BookCard key={book.id} book={book} onFavorite={(id, value) => setBooks((items) => items.map((item) => item.id === id ? { ...item, isFavorite: value } : item))}/>)}</div>{loading && <p className="loading" role="status">正在读取校园书架…</p>}{!loading && !books.length && !error && <Empty title="校园书架等你添上第一本书" link="/publish" label="去发布书籍"/>}<p className="sync-caption">书架每5秒同步，书籍与交易信息由发布者提供。</p></section>
  </>
}

export function CatalogPage({ search }: { search: string }) {
  const params = useMemo(() => new URLSearchParams(search), [search])
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const filters = useMemo<BookFilters>(() => ({
    sort: (['relevance','newest','price_asc','price_desc'].includes(params.get('sort') ?? '') ? params.get('sort') : 'relevance') as BookFilters['sort'],
    availableOnly: params.get('available') === '1', condition: params.get('condition') || undefined,
    hasNotes: params.has('notes') ? params.get('notes') === '1' : undefined,
    minPriceCents: params.has('min') ? Number(params.get('min')) : undefined,
    maxPriceCents: params.has('max') ? Number(params.get('max')) : undefined,
  }), [params])
  const [books, setBooks] = useState<Book[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  function go(changes: Record<string, string | undefined>, nextPage = 1) { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(changes)) { if (value === undefined || value === '') next.delete(key); else next.set(key, value) }; next.set('page', String(nextPage)); navigate('/discover?' + next) }
  const sync = useCallback(async (current: () => boolean) => {
    try { const result = await fetchBooks(query, category, filters, page); if (current()) {
      const last = Math.max(1, Math.ceil(result.total / result.pageSize))
      if (page > last) { const next = new URLSearchParams(search); next.set('page', String(last)); navigate('/discover?' + next, true); return }
      setBooks(result.items); setTotal(result.total); setError('')
    } }
    catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '搜索暂时不可用') }
    finally { if (current()) setLoading(false) }
  }, [query, category, filters, page, search])
  useLiveRefresh(sync, true, revision)
  function apply(value: BookFilters) { go({ sort: value.sort, available: value.availableOnly ? '1' : undefined, condition: value.condition, notes: value.hasNotes === undefined ? undefined : value.hasNotes ? '1' : '0', min: value.minPriceCents?.toString(), max: value.maxPriceCents?.toString() }) }
  return <><SearchBar value={query} onSearch={(q) => go({ q })}/><nav className="category-tabs" aria-label="分类筛选">{[['all','全部'],['textbook','教材'],['reading','课外读物'],['donation','免费赠书']].map(([value,label]) => <button key={value} aria-pressed={category === value} onClick={() => go({ category: value })}>{label}</button>)}</nav><div className="sort-tabs">{[['relevance','综合'],['price_asc','价格从低到高'],['newest','最新发布']].map(([value,label]) => <button key={value} aria-pressed={filters.sort === value} onClick={() => go({ sort: value })}>{label}</button>)}</div><details className="catalog-filters"><summary>筛选价格、品相与笔记</summary><BookFilterForm filters={filters} onApply={apply}/></details><div className="results-heading"><span>{loading ? '正在查找…' : `${query ? `“${query}” · ` : ''}找到 ${total} 本书`}</span><button onClick={() => setRevision((n) => n + 1)}>刷新</button></div>{error && <ErrorNotice message={error} retry={() => setRevision((n) => n + 1)}/>}<div className="book-list">{books.map((book) => <BookCard key={book.id} book={book} onFavorite={(id, value) => setBooks((items) => items.map((item) => item.id === id ? { ...item, isFavorite: value } : item))}/>)}</div>{!loading && !error && !books.length && <Empty title="暂时没有找到这本书">可以试试完整书名、作者、“高数”“线代”或ISBN。</Empty>}<Pagination page={page} total={total} onPage={(next) => go({}, next)}/></>
}

export function PersonalBooksPage({ kind, page }: { kind: string; page: number }) {
  const { notice } = useSession()
  const [books, setBooks] = useState<Book[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [revision, setRevision] = useState(0)
  const [seller, setSeller] = useState<PublicUser | null>(null)
  const sync = useCallback(async (current: () => boolean) => {
    try { const result = await fetchPersonalBooks(kind, page); const profile = kind !== 'mine' && kind !== 'favorites' ? await fetchPublicUser(kind) : null; if (current()) { setBooks(result.items); setTotal(result.total); setSeller(profile); setError('') } }
    catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '读取失败') }
    finally { if (current()) setLoading(false) }
  }, [kind, page])
  useLiveRefresh(sync, !busy, revision)
  return <>{seller && <section className="public-profile"><Avatar large name={seller.nickname} url={seller.avatarUrl}/><h1>{seller.nickname}</h1><p>{seller.college}</p><p>{seller.bio || '这个书友还没有填写介绍。'}</p></section>}{error && <ErrorNotice message={error} retry={() => setRevision((n) => n + 1)}/>}<div className={kind === 'mine' ? 'owned-books' : 'book-list'}>{books.map((book) => kind !== 'mine' ? <BookCard book={book} key={book.id} onFavorite={(id, value) => setBooks((items) => items.map((item) => item.id === id ? { ...item, isFavorite: value } : item))}/> : <article className="owned-book" key={book.id}><Link to={`/books/${book.id}`} className="owned-book-info"><div className="mini-cover">{book.coverUrl ? <img src={book.coverUrl} alt=""/> : <Icon name="book"/>}</div><div><h3>{book.title}</h3><strong className="price">¥{book.price.toFixed(2)}</strong><small>{book.edition} · {book.condition}</small></div><span className={`status-pill ${book.status}`}>{({ available: '在售', reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' })[book.status]}</span></Link>{book.isSuspended && <p className="moderation-note">管理限制中 · {book.moderationReason}</p>}{!book.isSuspended && ['available','offline','draft'].includes(book.status) && <div className="book-manage-actions"><Link to={`/books/${book.id}/edit`}>编辑资料</Link><Link to={`/books/${book.id}/images`}>管理图片</Link><Link to={`/books/${book.id}/recognize`}>AI识别</Link><button disabled={!!busy} onClick={async () => { setBusy(book.id); setError(''); try { await setBookVisibility(book.id, book.status === 'available' ? 'offline' : 'publish'); notice('书籍状态已更新'); setRevision((n) => n + 1) } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') } finally { setBusy('') } }}>{book.status === 'available' ? '下架' : '重新发布'}</button></div>}</article>)}</div>{loading && <p role="status" className="loading">正在读取…</p>}{!loading && !error && !books.length && <Empty title={kind === 'mine' ? '还没有发布书籍' : kind === 'favorites' ? '还没有收藏好书' : '这位书友暂时没有在售书籍'} link={kind === 'mine' ? '/publish' : '/discover'} label={kind === 'mine' ? '去发布' : '去逛逛'}/>}<Pagination page={page} total={total} onPage={(next) => navigate((kind === 'mine' ? '/me/books' : kind === 'favorites' ? '/me/favorites' : '/users/' + kind) + '?page=' + next)}/></>
}
