import { useEffect, useState } from 'react'
import { getSignedInId } from '../auth/auth-api'
import type { Book } from '../../types/books'
import { fetchBookImages, type BookImage } from './book-image-api'
import './media.css'

export function BookDetailDialog({ book, reserving = false, onClose, onReserve, onReport, onRecognize }: { book: Book; reserving?: boolean; onClose: () => void; onReserve: () => void; onReport: () => void; onRecognize: () => void }) {
  const ownBook = !!book.sellerId && book.sellerId === getSignedInId()
  const isAvailable = book.status === 'available' && !ownBook && !book.isSuspended
  const statusLabels: Record<Book['status'], string> = { available: '在售', reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' }
  const [images, setImages] = useState<BookImage[]>([])
  const [imageIndex, setImageIndex] = useState(0)
  const [imageError, setImageError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (import.meta.env.VITE_USE_API === 'false') return
    let active = true
    fetchBookImages(book.id).then((result) => { if (active) { setImages(result); setImageError(''); setImageIndex(0) } }).catch(() => { if (active) setImageError('暂时无法读取图片') })
    return () => { active = false }
  }, [book.id, revision])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="book-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭详情">×</button>
        <div className="detail-top">
          <div className="detail-cover book-cover" style={{ background: book.coverColor }} aria-hidden={images.length === 0}>{images[imageIndex] ? <img className="detail-cover-image" src={images[imageIndex].url} alt={`${book.title}图片${imageIndex + 1}`} /> : <span>{book.coverText}</span>}</div>
          <div className="detail-heading"><span className={`status-pill ${book.status}`}>{statusLabels[book.status]}</span><h2 id="book-detail-title">{book.title}</h2><p>{book.author} · {book.publisher}</p><strong>{book.category === 'donation' ? '免费赠送' : `¥${book.price}`}</strong></div>
        </div>
        {images.length > 1 && <div className="gallery-thumbs" aria-label="书籍相册">{images.map((image, index) => <button key={image.id} aria-label={`查看图片${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}><img src={image.url} alt="" /></button>)}</div>}
        {imageError && <p role="alert">{imageError} <button onClick={() => setRevision((n) => n + 1)}>重新读取图片</button></p>}
        {book.isSuspended && <p className="moderation-note">管理限制中 · {book.moderationReason}</p>}
        <div className="detail-grid">
          <DetailItem label="版本" value={book.edition} />
          <DetailItem label="新旧程度" value={book.condition} />
          <DetailItem label="取书地点" value={book.pickupPoint} />
          <DetailItem label="距离" value={book.distance} />
        </div>
        {book.description && <p className="dialog-intro">{book.description}</p>}
        <div className="detail-note"><strong>交易提示</strong><p>预约成功后，双方在校内公共地点当面核对书籍，再完成付款和交接。</p></div>
        <button className="primary-action" disabled={!isAvailable || reserving} onClick={onReserve}>{reserving ? '正在提交预约…' : ownBook ? '这是你发布的书籍' : isAvailable ? '预约交接' : '暂不可预约'}</button>
        {!book.isSuspended && ['available', 'offline', 'draft'].includes(book.status) && (ownBook || import.meta.env.VITE_USE_API === 'false') && <button className="secondary-action" onClick={onRecognize}>查看 AI 候选信息</button>}
        <button className="secondary-action" onClick={onReport}>反馈问题</button>
      </section>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}
