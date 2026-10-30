import { useEffect, useState } from 'react'
import { recognizeBook, type BookRecognition } from '../books/book-api'
import type { Book } from '../../types/books'

export function AIRecognitionDialog({ book, useApi, onClose }: { book: Book; useApi: boolean; onClose: () => void }) {
  const mockResult: BookRecognition = { title: { value: book.title, confidence: .98 }, author: { value: book.author, confidence: .72 }, publisher: { value: book.publisher, confidence: .72 }, edition: { value: book.edition, confidence: .7 }, warnings: book.publisher === '待补充' ? ['出版社信息不完整，请人工补充'] : [], provider: 'mock-demo' }
  const [result, setResult] = useState<BookRecognition | null>(useApi ? null : mockResult)
  const [loading, setLoading] = useState(useApi)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!useApi) return
    recognizeBook(book.id).then(setResult).catch(() => setError('AI 服务暂时不可用，请稍后重试')).finally(() => setLoading(false))
  }, [book, useApi])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭 AI 识别">×</button>
        <span className="section-kicker">AI 信息枢纽</span>
        <h2 id="ai-dialog-title">书籍信息识别</h2>
        <p className="dialog-intro">AI 只整理候选信息，发布者仍需要核对识别结果。</p>
        {loading && <div className="ai-loading"><span className="ai-spinner">✦</span><strong>正在整理书籍信息...</strong><small>识别书名、版本、出版社并检查缺失字段</small></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && <><div className="ai-provider">Provider：{result.provider}</div><div className="ai-fields">{[['书名', result.title], ['作者', result.author], ['出版社', result.publisher], ['版本', result.edition]].map(([label, field]) => { const value = field as { value: string | null; confidence: number }; return <div className="ai-field" key={label as string}><div><span>{label as string}</span><strong>{value.value || '未识别'}</strong></div><small>{Math.round(value.confidence * 100)}%</small></div> })}</div>{result.warnings.length > 0 && <div className="ai-warning"><strong>需要人工核对</strong>{result.warnings.map((warning) => <p key={warning}>· {warning}</p>)}</div>}<button className="primary-action" onClick={onClose}>我已了解</button></>}
      </section>
    </div>
  )
}
