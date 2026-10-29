import type { Book } from '../../types/books'

export function BookCard({ book, onOpen }: { book: Book; onOpen: (book: Book) => void }) {
  return (
    <button className="book-card" onClick={() => onOpen(book)} aria-label={`查看${book.title}详情`}>
      <div className="book-cover" style={{ background: book.coverColor }} aria-hidden="true"><span>{book.coverText}</span></div>
      <div className="book-info">
        <div className="book-title-row"><h3>{book.title}</h3><span className="distance">{book.distance}</span></div>
        <p className="book-meta">{book.edition} · {book.condition}</p>
        <div className="book-tags">{book.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="book-bottom-row"><strong className="price">¥{book.price}</strong><span className="location">⌖ {book.pickupPoint}</span></div>
      </div>
    </button>
  )
}
