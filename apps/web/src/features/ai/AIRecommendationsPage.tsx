import { useState, type FormEvent } from 'react'
import { Link } from '../../components/Link'
import { ErrorNotice, Icon } from '../../components/ui'
import { apiRequest } from '../../lib/api-client'
import { toBook, type BookApiRecord } from '../books/book-api'
import { PlaceSearch, type Place } from '../maps/PlaceSearch'

interface RecommendationResult {
  items: { book: BookApiRecord; distanceMeters: number | null }[]
  keywords: string[]
  source: 'deepseek' | 'keyword'
  unlocatedCount: number
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} 米` : `${(meters / 1000).toFixed(2)} 公里`
}

export function AIRecommendationsPage() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'price' | 'distance'>('price')
  const [originText, setOriginText] = useState('')
  const [origin, setOrigin] = useState<Place | null>(null)
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || !query.trim() || (sort === 'distance' && !origin)) return
    setResult(null)
    setError('')
    setLoading(true)
    try {
      const recommendations = await apiRequest<RecommendationResult>('/ai/recommendations', {
        method: 'POST',
        body: JSON.stringify({ query: query.trim(), sort, origin: sort === 'distance' ? origin?.location : null }),
      })
      setResult(recommendations)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法找书，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return <div className="page-section smart-search-page">
    <form className="form-card" onSubmit={submit}>
      <h2>告诉我你想找哪本书</h2>
      <p className="field-help">输入书名、版本或 ISBN，在校园书架中找出价格最低或距离最近的匹配书籍。</p>
      <fieldset disabled={loading}>
        <label>找书描述
          <textarea required maxLength={200} rows={3} value={query} onChange={(event) => {
            setQuery(event.target.value)
            setResult(null)
          }} placeholder="例如：想找同济版高等数学第七版上册"/>
        </label>
        <label>优先排序
          <select value={sort} onChange={(event) => {
            setSort(event.target.value === 'distance' ? 'distance' : 'price')
            setResult(null)
          }}>
            <option value="price">价格最低</option>
            <option value="distance">距离最近</option>
          </select>
        </label>
        {sort === 'distance' && <div className="smart-search-origin">
          <label>从哪里出发？
            <input maxLength={120} value={originText} placeholder="例如：武汉大学信息学部图书馆" onChange={(event) => {
              setOriginText(event.target.value)
              setOrigin(null)
              setResult(null)
            }}/>
          </label>
          <PlaceSearch query={originText} onSelect={(place) => { setOrigin(place); setOriginText(place.name); setResult(null) }}/>
          <p className="field-help" role="status">{origin ? `已选起点：${origin.name}` : '搜索并选用一个公共地点，以该地点计算直线距离。'}</p>
        </div>}
        <button className="primary-action" type="submit" disabled={loading || !query.trim() || (sort === 'distance' && !origin)}>
          {loading ? '正在匹配书籍…' : '找匹配的书'}
        </button>
      </fieldset>
      {loading && <p className="field-help" role="status">正在检索校园书架。</p>}
      {error && <ErrorNotice message={error}/>}
    </form>
    {result && <section className="smart-search-results" aria-labelledby="match-heading">
      <h2 id="match-heading">{sort === 'price' ? '按价格推荐' : '按距离推荐'}</h2>
      <p className="field-help">{result.source === 'deepseek' ? 'DeepSeek 提取的检索词' : '按原关键词检索'}：{result.keywords.join(' · ')}</p>
      {result.unlocatedCount > 0 && <p className="field-help">另有 {result.unlocatedCount} 本匹配书籍未标记地图位置，可切换到价格排序查看。</p>}
      {!result.items.length && <p className="info-note" role="status">
        {result.unlocatedCount ? '匹配的书籍暂时都没有地图位置。' : '暂无可预约的匹配书籍。试试简化书名或版本。'}
      </p>}
      <ul className="recommendation-list">
        {result.items.map(({ book: record, distanceMeters }) => {
          const book = toBook(record)
          return <li key={book.id}><Link to={`/books/${book.id}`}>
            <div><strong>{book.title}</strong><small>{book.author} · {book.edition}</small><small>{book.pickupPoint}</small></div>
            <div><strong className="price">{book.price === 0 ? '免费' : `¥${book.price.toFixed(2)}`}</strong>
              {distanceMeters !== null && <small>直线 {formatDistance(distanceMeters)}</small>}</div>
          </Link></li>
        })}
      </ul>
    </section>}
    <Link className="pickup-map-link" to="/me/books"><Icon name="camera" size={18}/>给我的书识别封面</Link>
  </div>
}
