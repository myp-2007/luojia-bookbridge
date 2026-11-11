import { useEffect, useState, type FormEvent } from 'react'
import { Avatar, ErrorNotice, Icon } from '../../components/ui'
import { navigate } from '../../lib/router'
import { Link } from '../../components/Link'
import { apiRequest } from '../../lib/api-client'
import { useSession } from '../auth/session'
import { fetchPublicUser, type PublicUser } from '../auth/auth-api'
import type { Book } from '../../types/books'
import { fetchBookImages, type BookImage } from './book-image-api'
import { toggleFavorite } from './book-api'
import { PickupMapLink, PlaceSearch } from '../maps/PlaceSearch'

export function BookDetailPage({ book, refresh, onFavorite }: { book: Book; refresh: () => void; onFavorite: (value: boolean) => void }) {
  const { user, notice } = useSession()
  const [images, setImages] = useState<BookImage[]>([])
  const [index, setIndex] = useState(0)
  const [seller, setSeller] = useState<PublicUser | null>(null)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [intent, setIntent] = useState(false)
  const [pickup, setPickup] = useState(book.pickupPoint)
  const [proposed, setProposed] = useState('')
  const saved = book.isFavorite ?? false
  const own = user?.id === book.sellerId
  const editable = own && !book.isSuspended && ['available','offline','draft'].includes(book.status)
  const available = book.status === 'available' && !book.isSuspended && !own && book.sellerActive !== false
  useEffect(() => {
    let current = true
    fetchBookImages(book.id).then((result) => { if (current) { setImages(result); setImageError(''); setIndex((old) => Math.min(old, Math.max(0, result.length - 1))) } }).catch(() => { if (current) setImageError('图片暂时无法加载') })
    if (book.sellerId) fetchPublicUser(book.sellerId).then((result) => { if (current) setSeller(result) }).catch(() => {})
    return () => { current = false }
  }, [book.id, book.coverUrl, book.sellerId, revision])
  function loginFirst() { navigate('/login?next=' + encodeURIComponent('/books/' + book.id)) }
  async function reserve(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (!user) { loginFirst(); return }
    setBusy(true); setError('')
    try {
      await apiRequest(`/books/${book.id}/reservations`, { method: 'POST', body: JSON.stringify({ pickupPoint: pickup.trim(), proposedTime: proposed ? new Date(proposed).toISOString() : null }) })
      notice('预约已提交，等待卖家接受'); navigate('/records')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '预约失败'); refresh() }
    finally { setBusy(false) }
  }
  const image = images[index]?.url ?? book.coverUrl
  return <article className="book-detail-page"><div className="detail-gallery"><div className="detail-main-image">{image ? <img src={image} alt={`${book.title}图片${index + 1}`}/> : <div className="missing-cover"><Icon name="book" size={64}/><span>发布者尚未上传照片</span></div>}{images.length > 0 && <span className="image-counter">{index + 1} / {images.length}</span>}</div>{images.length > 1 && <div className="gallery-thumbs" aria-label="书籍相册">{images.map((item, n) => <button key={item.id} aria-label={`查看图片${n + 1}`} aria-pressed={index === n} onClick={() => setIndex(n)}><img src={item.url} alt=""/></button>)}</div>}{imageError && <ErrorNotice message={imageError} retry={() => setRevision((n) => n + 1)}/>}</div>
    <div className="detail-body"><section className="detail-summary"><div className="detail-price-row"><strong className="detail-price">{book.category === 'donation' ? '免费赠送' : `¥${book.price.toFixed(2)}`}</strong><span className="condition-badge">{book.condition}</span><span className={`status-pill ${book.status}`}>{({ available: '在售', reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' })[book.status]}</span></div><h1>{book.title}</h1><p className="muted">{book.author} 著</p><div className="book-tags"><span>{book.category === 'textbook' ? '教材' : book.category === 'reading' ? '课外读物' : '免费赠书'}</span><span>{book.tags.includes('有笔记') ? '有笔记' : '无笔记'}</span></div></section>
      {book.isSuspended && <p className="moderation-note">管理限制中 · {book.moderationReason}</p>}
      <dl className="book-facts"><div><dt>版本</dt><dd>{book.edition}</dd></div><div><dt>出版社</dt><dd>{book.publisher}</dd></div>{book.isbn && <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>}<div><dt>新旧程度</dt><dd>{book.condition}</dd></div><div><dt>笔记情况</dt><dd>{book.tags.includes('有笔记') ? '有笔记，请核对图片' : '无笔记'}</dd></div><div><dt>取书地点</dt><dd>{book.pickupPoint}</dd></div></dl>
      <PickupMapLink label={book.pickupPoint} location={book.pickupLocation}/>
      {seller && <Link className="seller-card" to={'/users/' + seller.id}><Avatar url={seller.avatarUrl} name={seller.nickname}/><div><strong>{seller.nickname}</strong><p>{seller.college || '珞珈书桥书友'}</p></div><Icon name="arrow" size={18}/></Link>}
      {book.description && <section className="book-description"><h2>关于这本书</h2><p>{book.description}</p></section>}
      <p className="info-note">请在线下公共地点核对版本、品相和笔记。平台不收款，双方自行完成付款和交接后分别确认。</p>
      {intent && available && <form className="reserve-form form-card" onSubmit={reserve}><h2>预约交接</h2><fieldset disabled={busy}><label>交接地点<input required maxLength={120} value={pickup} onChange={(e) => setPickup(e.target.value)}/></label><PlaceSearch query={pickup} onSelect={(_, label) => setPickup(label)}/><label>建议时间（可选）<input type="datetime-local" value={proposed} onChange={(e) => setProposed(e.target.value)}/></label><p className="field-help">提交后请等待卖家接受，再在交易记录中查看对方主动提供的联系方式。</p><button className="primary-action" disabled={busy}>{busy ? '正在提交…' : '确认预约'}</button></fieldset></form>}
      {error && <ErrorNotice message={error}/>}
      <div className="detail-secondary-links">{editable && <Link to={`/books/${book.id}/recognize`}>AI识别书籍信息</Link>}<Link to={`/books/${book.id}/report`}>反馈书籍问题</Link></div>
    </div>
    <footer className="detail-action-bar"><button className={`detail-favorite ${saved ? 'saved' : ''}`} aria-pressed={saved} disabled={busy} onClick={async () => { if (!user) { loginFirst(); return }; setBusy(true); setError(''); try { await toggleFavorite(book.id, saved); onFavorite(!saved); refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : '收藏失败') } finally { setBusy(false) } }}><Icon name="heart"/><span>{saved ? '已收藏' : '收藏'}</span></button>{editable ? <><Link className="button secondary" to={`/books/${book.id}/images`}>管理图片</Link><Link className="button primary" to={`/books/${book.id}/edit`}>编辑书籍</Link></> : <>{seller && <Link className="button secondary" to={'/users/' + seller.id}>卖家主页</Link>}<button className="button primary" disabled={!available || busy} onClick={() => { if (!user) { loginFirst(); return }; setIntent(true); requestAnimationFrame(() => document.querySelector('.reserve-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }}>{own ? '这是你发布的书' : available ? '预约交接' : book.sellerActive === false ? '发布者暂不可交易' : '暂不可预约'}</button></>}</footer>
  </article>
}
