import { useState } from 'react'
import type { Book } from '../../types/books'
import { navigate } from '../../lib/router'
import { Link } from '../../components/Link'
import { Icon } from '../../components/ui'
import { useSession } from '../auth/session'
import { toggleFavorite } from './book-api'

export function BookCard({ book, onFavorite }: { book: Book; onOpen?: (book: Book) => void; onFavorite?: (id: string, value: boolean) => void }) {
  const { user } = useSession()
  const saved = book.isFavorite ?? false
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [error, setError] = useState('')
  return <article className="book-card"><Link className="book-card-link" to={`/books/${book.id}`} aria-label={`查看${book.title}详情`}><div className="book-cover">{book.coverUrl && failed !== book.coverUrl ? <img src={book.coverUrl} alt="" loading="lazy" onError={() => setFailed(book.coverUrl ?? '')}/> : <><Icon name="book" size={38}/><span>{book.title.slice(0, 10)}</span></>}</div><div className="book-info"><h3>{book.title}</h3><p className="book-author">{book.author === '待补充' ? book.publisher : book.author}</p><div className="book-tags"><span>{book.category === 'donation' ? '免费赠书' : book.category === 'reading' ? '课外读物' : '教材'}</span>{book.tags.includes('有笔记') && <span>有笔记</span>}</div><strong className="price">{book.category === 'donation' ? '免费赠送' : `¥${book.price.toFixed(2)}`}</strong><p className="book-meta">{book.condition} · {book.sellerActive === false ? '暂不可交易' : book.status === 'available' ? '可预约' : ({ reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' })[book.status]}</p><p className="book-location"><Icon name="pin" size={12}/>{book.pickupPoint}</p></div></Link><button className={`favorite-button ${saved ? 'saved' : ''}`} disabled={busy} aria-label={`${saved ? '取消收藏' : '收藏'}${book.title}`} aria-pressed={saved} onClick={async () => {
    if (!user) { navigate('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return }
    if (busy) return
    setBusy(true); setError('')
    try { await toggleFavorite(book.id, saved); onFavorite?.(book.id, !saved) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '收藏失败') }
    finally { setBusy(false) }
  }}><Icon name="heart" size={19}/></button>{error && <p role="alert" className="card-error">{error}</p>}</article>
}
