import { useCallback, useState } from 'react'
import { useLiveRefresh } from '../../lib/use-live-refresh'
import type { Book } from '../../types/books'
import { uploadBookImage } from './book-api'
import { deleteBookImage, fetchBookImages, setBookCover, type BookImage } from './book-image-api'

export function BookImagesPage({ book, onClose, onChanged }: { book: Book; onClose: () => void; onChanged: () => void }) {
  const [images, setImages] = useState<BookImage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const sync = useCallback(async (isCurrent: () => boolean) => {
    try {
      const result = await fetchBookImages(book.id)
      if (isCurrent()) { setImages(result); setError('') }
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : '图片读取失败') }
    finally { if (isCurrent()) setLoading(false) }
  }, [book.id])
  useLiveRefresh(sync, !busy && !deleting, revision)

  async function perform(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await action()
      setDeleting(null)
      // Re-read even after a lost response; the server is the source of truth.
      const result = await fetchBookImages(book.id)
      setImages(result); onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请刷新后重试') }
    finally { setBusy(false) }
  }

  return <div className="page-section">
    <section className="form-card media-panel" role="region" aria-labelledby="media-title" onMouseDown={(event) => event.stopPropagation()}>
      <span className="section-kicker">整理你的书籍</span><h2 id="media-title">图片管理</h2><p>{book.title}</p>
      <p className="account-hint">最多3张，每张5MB以内。第一张用作书架封面，可选择其他图片替换封面。</p>
      {loading ? <p role="status">正在读取图片…</p> : <div className="media-grid">{images.map((image, index) => <article className="media-item" key={image.id}>
        <img src={image.url} alt={`书籍图片${index + 1}`} /><span>{index === 0 ? '当前封面' : `图片 ${index + 1}`}</span>
        <div className="account-actions"><button disabled={busy || index === 0} onClick={() => perform(() => setBookCover(book.id, image.id))}>设为封面</button><button disabled={busy} onClick={() => setDeleting(image.id)}>删除图片</button></div>
        {deleting === image.id && <div className="media-confirm"><p>确定删除这张图片？</p><button disabled={busy} onClick={() => perform(() => deleteBookImage(book.id, image.id))}>确认删除</button><button disabled={busy} onClick={() => setDeleting(null)}>保留图片</button></div>}
      </article>)}</div>}
      {!loading && images.length === 0 && <p>还没有图片，上传封面让同学更容易找到这本书。</p>}
      <label className="media-upload">添加书籍图片<input type="file" disabled={busy || loading || images.length >= 3} accept="image/jpeg,image/png,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ''
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { setError('图片不能超过5MB'); return }
        void perform(() => uploadBookImage(book.id, file))
      }} /></label>
      {images.length >= 3 && <p className="account-hint">已达到3张上限，删除后可继续上传。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="account-actions"><button disabled={busy} onClick={() => { setDeleting(null); setRevision((n) => n + 1) }}>刷新图片</button><button disabled={busy} onClick={onClose}>完成整理</button></div>
    </section>
  </div>
}
