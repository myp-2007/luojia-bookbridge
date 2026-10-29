import { useState, type FormEvent } from 'react'
import type { Book } from '../../types/books'

export function PublishBookDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (book: Book, imageFile?: File) => void | Promise<void> }) {
  const [title, setTitle] = useState('')
  const [edition, setEdition] = useState('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('9成新')
  const [imageFile, setImageFile] = useState<File | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !price.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        id: `book-local-${Date.now()}`,
        title: title.trim(), author: '待补充', publisher: '待补充', edition: edition.trim() || '待补充', condition,
        price: Number(price), category: 'textbook', status: 'available', tags: ['待审核'], pickupPoint: '请选择交接点', distance: '待计算', coverText: title.trim().slice(0, 8), coverColor: 'linear-gradient(145deg, #2f8064, #91bd75)',
      }, imageFile)
    } catch {
      setError('发布失败，请检查服务器连接后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="publish-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-title-row"><div><span className="section-kicker">发布书籍</span><h2>让下一位同学找到它</h2></div><button type="button" className="dialog-close" onClick={onClose} aria-label="关闭发布表单">×</button></div>
        <p className="dialog-intro">先填写基础信息，图片识别和课程匹配会在后续接口接入后自动辅助完成。</p>
        <label>书名<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：高等数学（第七版）" /></label>
        <div className="form-row"><label>版本<input value={edition} onChange={(event) => setEdition(event.target.value)} placeholder="例如：第七版" /></label><label>价格<input required type="number" min="0" step="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="元" /></label></div>
        <label>新旧程度<select value={condition} onChange={(event) => setCondition(event.target.value)}><option>全新</option><option>9成新</option><option>8成新</option><option>7成新及以下</option></select></label>
        <label>书籍图片<span className="file-input-wrap"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageFile(event.target.files?.[0])} /><small>{imageFile ? imageFile.name : '可选，支持 JPG、PNG、WebP'}</small></span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? '正在发布...' : '保存并发布'}</button>
      </form>
    </div>
  )
}
