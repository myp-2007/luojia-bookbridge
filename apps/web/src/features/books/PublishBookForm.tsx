import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fetchPickupPoints } from './book-api'
import type { Book, BookCategory } from '../../types/books'
import { Icon } from '../../components/ui'
import { PlaceSearch } from '../maps/PlaceSearch'

export function PublishBookForm({ initialBook, onSubmit }: {
  initialBook?: Book; onSubmit: (book: Book, files?: File[]) => void | Promise<void>
}) {
  const [title, setTitle] = useState(initialBook?.title ?? '')
  const [author, setAuthor] = useState(initialBook?.author === '待补充' ? '' : initialBook?.author ?? '')
  const [publisher, setPublisher] = useState(initialBook?.publisher === '待补充' ? '' : initialBook?.publisher ?? '')
  const [edition, setEdition] = useState(initialBook?.edition === '待补充' ? '' : initialBook?.edition ?? '')
  const [isbn, setIsbn] = useState(initialBook?.isbn ?? '')
  const [price, setPrice] = useState(initialBook ? String(initialBook.price) : '')
  const [condition, setCondition] = useState(initialBook?.condition ?? '9成新')
  const [category, setCategory] = useState<BookCategory>(initialBook?.category ?? 'textbook')
  const [notes, setNotes] = useState(initialBook?.tags.includes('有笔记') ?? false)
  const [description, setDescription] = useState(initialBook?.description ?? '')
  const [pickup, setPickup] = useState(initialBook?.pickupPoint ?? '')
  const [pickupLocation, setPickupLocation] = useState(initialBook?.pickupLocation ?? null)
  const [points, setPoints] = useState<string[]>([])
  const [attachments, setAttachments] = useState<{ file: File; url: string }[]>([])
  const urls = useRef<string[]>([])
  const files = attachments.map((item) => item.file)
  const previews = attachments.map((item) => item.url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; fetchPickupPoints().then((result) => { if (active) setPoints(result.items.map((point) => point.name)) }).catch(() => {}); return () => { active = false } }, [])
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!title.trim() || !pickup.trim() || !price.trim()) { setError('请填写书名、价格和交接地点'); return }
    setBusy(true); setError('')
    try {
      await onSubmit({
        id: initialBook?.id ?? `local-${Date.now()}`, sellerId: initialBook?.sellerId,
        title: title.trim(), author: author.trim(), publisher: publisher.trim(), edition: edition.trim(), isbn: isbn.trim() || null,
        price: Number(price), category, condition, description: description.trim(),
        status: initialBook?.status ?? 'available', tags: notes ? ['有笔记'] : ['无笔记'],
        pickupPoint: pickup.trim(), pickupLocation, distance: '校内', coverText: title.slice(0, 8), coverColor: '#edf4ef',
      }, files)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试') }
    finally { setBusy(false) }
  }
  return <form className="publish-form form-card" onSubmit={submit}>
    <fieldset disabled={busy}>
      {!initialBook && <><div className="photo-picker">{previews.map((url, index) => <div className="photo-preview" key={url}><img src={url} alt={`待发布图片${index + 1}`} /><button type="button" aria-label={`移除图片${index + 1}`} onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}>×</button></div>)}{files.length < 3 && <label className="photo-add"><Icon name="camera" size={29}/><span>上传书籍照片</span><small>最多3张</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="上传书籍照片" onChange={(event) => {
        const incoming = Array.from(event.target.files ?? []); event.target.value = ''
        if (incoming.some((file) => file.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))) { setError('请选择5MB以内的JPG、PNG或WebP图片'); return }
        if (files.length + incoming.length > 3) { setError('每本书最多3张图片'); return }
        setError(''); const additions = incoming.map((file) => ({ file, url: URL.createObjectURL(file) })); urls.current.push(...additions.map((item) => item.url)); setAttachments((current) => [...current, ...additions])
      }}/></label>}</div><p className="field-help">清晰的封面、封底和笔记照片，会让下一位同学更放心。</p></>}
      <label>书名 <span className="required">*</span><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：高等数学（第七版）上册" aria-label="书名"/></label>
      <div className="form-row"><label>作者<input maxLength={160} value={author} onChange={(e) => setAuthor(e.target.value)}/></label><label>版本<input maxLength={80} value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="例如：第七版"/></label></div>
      <div className="form-row"><label>出版社<input maxLength={160} value={publisher} onChange={(e) => setPublisher(e.target.value)} /></label><label>ISBN（可选）<input maxLength={32} value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="封底10位或13位书号"/></label></div>
      <div className="form-row"><label>分类<select aria-label="分类" value={category} onChange={(e) => { const value = e.target.value as BookCategory; setCategory(value); if (value === 'donation') setPrice('0') }}><option value="textbook">教材交易</option><option value="reading">课外读物</option><option value="donation">免费赠书</option></select></label><label>价格（元）<input required disabled={category === 'donation'} type="number" min="0" max="100000" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label></div>
      <div className="form-row"><label>新旧程度<select value={condition} onChange={(e) => setCondition(e.target.value)}><option>全新</option><option>9成新</option><option>8成新</option><option>7成新及以下</option></select></label><label>笔记情况<select value={notes ? 'yes' : 'no'} onChange={(e) => setNotes(e.target.value === 'yes')}><option value="no">无笔记</option><option value="yes">有笔记</option></select></label></div>
      <label>取书地点 <span className="required">*</span><input required list="pickup-points" aria-label="交接地点" maxLength={120} value={pickup} onChange={(e) => { setPickup(e.target.value); setPickupLocation(null) }} placeholder="选择或填写校内公共地点"/><datalist id="pickup-points">{points.map((point) => <option key={point}>{point}</option>)}</datalist></label>
      <PlaceSearch query={pickup} onSelect={(place, label) => { setPickup(label); setPickupLocation(place.location) }}/>
      <p className="field-help">{pickupLocation ? '已标记地图位置，可参与距离排序。' : '可手动填写。选用地图地点后，买家能按距离找到这本书。'}</p>
      <label>补充说明<textarea maxLength={2000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="介绍书籍状况、笔记、缺页等情况，避免公开填写私密联系方式。"/></label>
      {category === 'donation' && <p className="info-note">免费赠书价格固定为0元，同样通过预约和双方确认完成交接。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-action" disabled={busy}>{busy ? '正在保存，请稍候…' : initialBook ? '保存修改' : '发布书籍'}</button>
    </fieldset>
  </form>
}
