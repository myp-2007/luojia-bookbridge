import { useEffect, useState } from 'react'
import { getSignedInId } from '../auth/auth-api'
import type { Book } from '../../types/books'
import { fetchBookImages, type BookImage } from './book-image-api'

export function BookDetailDialog({ book, reserving = false, onClose, onReserve, onReport, onRecognize }: { book: Book; reserving?: boolean; onClose: () => void; onReserve: () => void; onReport: () => void; onRecognize: () => void }) {
  const ownBook = !!book.sellerId && book.sellerId === getSignedInId()
  const isAvailable = book.status === 'available' && !ownBook
  const statusLabels: Record<Book['status'], string> = { available: '在售', reserved: '已预约', completed: '已完成', offline: '已下架', draft: '草稿' }
  const [images, setImages] = useState<BookImage[]>([])

  useEffect(() => {
    if (import.meta.env.VITE_USE_API === 'false') return
    let active = true
    fetchBookImages(book.id).then((result) => { if (active) setImages(result) }).catch(() => undefined)
    return () => { active = false }
  }, [book.id])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="book-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭详情">×</button>
        <div className="detail-top">
          <div className="detail-cover book-cover" style={{ background: book.coverColor }} aria-hidden={images.length === 0}>{images[0] ? <img className="detail-cover-image" src={images[0].url} alt={`${book.title}封面`} /> : <span>{book.coverText}</span>}</div>
          <div className="detail-heading"><span className={`status-pill ${book.status}`}>{statusLabels[book.status]}</span><h2 id="book-detail-title">{book.title}</h2><p>{book.author} · {book.publisher}</p><strong>¥{book.price}</strong></div>
        </div>
        <div className="detail-grid">
          <DetailItem label="版本" value={book.edition} />
          <DetailItem label="新旧程度" value={book.condition} />
          <DetailItem label="取书地点" value={book.pickupPoint} />
          <DetailItem label="距离" value={book.distance} />
        </div>
        {book.description && <p className="dialog-intro">{book.description}</p>}
        <div className="detail-note"><strong>交易提示</strong><p>预约成功后，双方在校内公共地点当面核对书籍，再完成付款和交接。</p></div>
        <button className="primary-action" disabled={!isAvailable || reserving} onClick={onReserve}>{reserving ? '正在提交预约…' : ownBook ? '这是你发布的书籍' : isAvailable ? '预约交接' : '暂不可预约'}</button>
        {(ownBook || import.meta.env.VITE_USE_API === 'false') && <button className="secondary-action" onClick={onRecognize}>查看 AI 候选信息</button>}
        <button className="secondary-action" onClick={onReport}>反馈问题</button>
      </section>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}
