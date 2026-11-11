import { useState } from 'react'
import { Icon } from '../../components/ui'
import { apiRequest } from '../../lib/api-client'
import type { Coordinates } from '../../types/books'

export interface Place {
  name: string
  address: string
  location: Coordinates
}

function placeLabel(place: Place) {
  return (place.address && place.address !== place.name ? `${place.name} · ${place.address}` : place.name).slice(0, 120)
}

export function PickupMapLink({ label, location }: { label: string; location?: Coordinates | null }) {
  if (!label.trim() || ['待选择交接点', '请选择交接点', '待双方协商'].includes(label)) return null
  const params = new URLSearchParams({ output: 'html', src: 'webapp.bookbridge.pickup' })
  if (location) {
    params.set('location', `${location.latitude},${location.longitude}`)
    params.set('title', label)
    params.set('content', label)
    params.set('coord_type', 'bd09ll')
  } else {
    params.set('query', label)
    params.set('region', '武汉市')
  }
  const path = location ? 'marker' : 'place/search'
  return <a className="pickup-map-link" href={`https://api.map.baidu.com/${path}?${params}`} target="_blank" rel="noreferrer">
    <Icon name="pin" size={16}/>在百度地图查看
  </a>
}

export function PlaceSearch({ query, onSelect }: {
  query: string; onSelect: (place: Place, label: string) => void
}) {
  const [lookup, setLookup] = useState<{ query: string; items: Place[]; error: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const keyword = query.trim()
  const result = lookup?.query === keyword ? lookup : null

  async function search() {
    if (!keyword || loading) return
    setLookup(null)
    setLoading(true)
    try {
      const { items } = await apiRequest<{ items: Place[] }>(`/maps/places?${new URLSearchParams({ q: keyword })}`)
      setLookup({ query: keyword, items, error: '' })
    } catch (cause) {
      setLookup({ query: keyword, items: [], error: cause instanceof Error ? cause.message : '暂时无法搜索地图' })
    } finally {
      setLoading(false)
    }
  }

  return <div className="place-search">
    <button type="button" className="button secondary" disabled={loading || !keyword} onClick={search}>
      <Icon name="pin" size={17}/>{loading ? '正在查询地点…' : '在百度地图搜索'}
    </button>
    {result?.error && <p className="form-error" role="alert">{result.error}</p>}
    {result && !result.error && result.items.length === 0 && <p className="field-help" role="status">未找到地点，试试更具体的校门或建筑名称。</p>}
    {!!result?.items.length && <ul className="place-results" aria-label="百度地图搜索结果">
      {result.items.map((place, index) => <li key={`${place.name}-${index}`}>
        <div><strong>{place.name}</strong>{place.address && <small>{place.address}</small>}</div>
        <button type="button" className="button secondary" aria-label={`选用${place.name}`} onClick={() => {
          setLookup(null)
          onSelect(place, placeLabel(place))
        }}>选用</button>
      </li>)}
    </ul>}
  </div>
}
