import { useEffect, useState, type FormEvent } from 'react'
import { fetchPickupPoints } from './book-api'
import type { Book, BookCategory } from '../../types/books'

export function PublishBookDialog({ onClose, onSubmit, initialBook }: {
  onClose: () => void; onSubmit: (book: Book, imageFile?: File) => void | Promise<void>; initialBook?: Book
}) {
  const [title, setTitle] = useState(initialBook?.title ?? '')
  const [author, setAuthor] = useState(initialBook?.author ?? '')
  const [publisher, setPublisher] = useState(initialBook?.publisher ?? '')
  const [edition, setEdition] = useState(initialBook?.edition ?? '')
  const [price, setPrice] = useState(initialBook ? String(initialBook.price) : '')
  const [condition, setCondition] = useState(initialBook?.condition ?? '9成新')
  const [category, setCategory] = useState<BookCategory>(initialBook?.category ?? 'textbook')
  const [notes, setNotes] = useState(initialBook?.tags.includes('有笔记') ?? false)
  const [description, setDescription] = useState(initialBook?.description ?? '')
  const [pickup, setPickup] = useState(initialBook?.pickupPoint ?? '')
  const [points, setPoints] = useState<string[]>([])
  const [imageFile, setImageFile] = useState<File>()
  const [preview, setPreview] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (import.meta.env.VITE_USE_API === 'false') return
    let active = true
    fetchPickupPoints().then((result) => { if (active) setPoints(result.items.map((point) => point.name)) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!imageFile) return
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [imageFile, preview])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !pickup.trim() || !price.trim()) { setError('请填写书名、价格和交接地点'); return }
    if (imageFile && (imageFile.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type))) {
      setError('请选择5MB以内的 JPG、PNG 或 WebP 图片'); return
    }
    setIsSubmitting(true); setError('')
    try {
      await onSubmit({
        id: initialBook?.id ?? `local-${Date.now()}`, sellerId: initialBook?.sellerId,
        title: title.trim(), author: author.trim(), publisher: publisher.trim(), edition: edition.trim(),
        condition, price: Number(price), category, description: description.trim(),
        status: initialBook?.status ?? 'available', tags: notes ? ['有笔记'] : ['无笔记'],
        pickupPoint: pickup.trim(), distance: '校内', coverText: title.trim().slice(0, 8),
        coverColor: initialBook?.coverColor ?? 'linear-gradient(145deg, #2f8064, #91bd75)',
      }, imageFile)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试') }
    finally { setIsSubmitting(false) }
  }

  return <div className="dialog-backdrop" onMouseDown={() => { if (!isSubmitting) onClose() }}>
    <form className="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="dialog-close" disabled={isSubmitting} onClick={onClose} aria-label="关闭发布表单">×</button>
      <span className="section-kicker">{initialBook ? '编辑书籍' : '发布书籍'}</span><h2 id="publish-title">让下一位同学找到它</h2>
      <p className="dialog-intro">请填写真实版本和品相，双方在校内公共地点核对后交接。</p>
      <label>书名<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="form-row"><label>作者<input maxLength={160} value={author} onChange={(event) => setAuthor(event.target.value)} /></label><label>出版社<input maxLength={160} value={publisher} onChange={(event) => setPublisher(event.target.value)} /></label></div>
      <div className="form-row"><label>版本<input maxLength={80} value={edition} onChange={(event) => setEdition(event.target.value)} /></label><label>价格（元）<input required disabled={category === 'donation'} type="number" min="0" max="100000" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label></div>
      <div className="form-row"><label>分类<select aria-label="分类" value={category} onChange={(event) => { const value = event.target.value as BookCategory; setCategory(value); if (value === 'donation') setPrice('0') }}><option value="textbook">教材</option><option value="reading">课外读物</option><option value="donation">免费赠书</option></select></label><label>新旧程度<select value={condition} onChange={(event) => setCondition(event.target.value)}><option>全新</option><option>9成新</option><option>8成新</option><option>7成新及以下</option></select></label></div>
      {category === 'donation' && <p className="dialog-intro">免费赠书不收取费用，同样通过预约和双方交接确认完成赠送。</p>}
      <label>笔记情况<select value={notes ? 'yes' : 'no'} onChange={(event) => setNotes(event.target.value === 'yes')}><option value="no">无笔记</option><option value="yes">有笔记</option></select></label>
      <label>交接地点<input required list="pickup-point-options" maxLength={120} value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="请选择或填写校内公共地点" /><datalist id="pickup-point-options">{points.map((point) => <option key={point} value={point} />)}</datalist></label>
      <label>补充说明<textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="缺页、划线或其他需要说明的情况" /></label>
      {!initialBook && <label>封面图片（可选）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; setImageFile(file); setPreview(file ? URL.createObjectURL(file) : '') }} /></label>}
      {preview && <img src={preview} alt="待上传封面预览" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 12 }} />}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? '正在保存…' : initialBook ? '保存修改' : '保存并发布'}</button>
    </form>
  </div>
}
