import type { Book } from '../../types/books'

export function BookDetailDialog({ book, onClose, onReserve, onReport }: { book: Book; onClose: () => void; onReserve: () => void; onReport: () => void }) {
  const isAvailable = book.status === 'available'

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="book-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭详情">×</button>
        <div className="detail-top">
          <div className="detail-cover book-cover" style={{ background: book.coverColor }} aria-hidden="true"><span>{book.coverText}</span></div>
          <div className="detail-heading"><span className={`status-pill ${book.status}`}>{isAvailable ? '在售' : '已预约'}</span><h2 id="book-detail-title">{book.title}</h2><p>{book.author} · {book.publisher}</p><strong>¥{book.price}</strong></div>
        </div>
        <div className="detail-grid">
          <DetailItem label="版本" value={book.edition} />
          <DetailItem label="新旧程度" value={book.condition} />
          <DetailItem label="取书地点" value={book.pickupPoint} />
          <DetailItem label="距离" value={book.distance} />
        </div>
        <div className="detail-note"><strong>交易提示</strong><p>预约成功后，双方在校内公共地点当面核对书籍，再完成付款和交接。</p></div>
        <button className="primary-action" disabled={!isAvailable} onClick={onReserve}>{isAvailable ? '预约交接' : '暂不可预约'}</button>
        <button className="secondary-action" onClick={onReport}>反馈问题</button>
      </section>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}
