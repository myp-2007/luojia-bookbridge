"""Refresh the small publisher-cover demo archive. Not needed at application startup.

Run with apps/api/.venv/Scripts/python.exe infra/fetch-demo-covers.py.
Only public catalogue metadata and cover thumbnails are downloaded, never book contents.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from hashlib import sha256
from html import unescape
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'seed' / 'demo-books'
BASE = 'https://xuanshu.hep.com.cn'
# IDs from the publisher catalogue, including both Tongji calculus volumes.
SOURCES = [
    ('calculus-1', '59cfa123ba9eb884cf8241de', 2200),
    ('calculus-2', '59cf6e8dba9eb884cf822dc2', 2000),
    ('linear-algebra', '6a060101e119ac97290262c6', 1600),
    ('probability', '6a060107e119ac9729026a80', 2500),
    ('discrete-math', '62e959df938b7cc2960eefa1', 1800),
    ('data-structures', '672114fee4efbc722ba48584', 3200),
    ('networks', '6532b35f74ce561611bd975b', 2600),
    ('physics', '60a54565adb85dae6a2f3fff', 1800),
    ('c-programming', '59cf2383ba9eb884cf8211f6', 1500),
    ('python', '69fcc5ece119ac97296e15c5', 2400),
    ('english-reading', '6a2998ede119ac9729408365', 1800),
    ('linear-geometry', '6887ad7ce119ac9729b1401a', 2100),
    ('linear-exercises', '69cd4f49e119ac97291a3009', 0),
    ('discrete-foundations', '6a5a6091e119ac972979b21c', 2400),
    ('math-culture', '59cc1bc8ba9eb884cf81583a', 2000),
]


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': BASE + '/'}), timeout=30) as response:
        return response.read()


def collect(item):
    slug, identifier, price = item
    source_url = BASE + '/front/book/findBookDetails?bookId=' + identifier
    html = fetch(source_url).decode('utf-8')
    title = unescape(re.search(r'<title>(.*?)</title>', html, re.S).group(1)).strip()
    image_url = re.search(r'book-detail-image[^>]*>.*?<img src="([^"]+)"', html, re.S).group(1)
    info = html[html.index('book-detail-info'):]
    plain = re.sub(r'\s+', ' ', unescape(re.sub('<[^>]+>', ' ', info)))
    author = re.search(r'作者：\s*(.*?)\s*定价', plain).group(1).strip()
    isbn = re.search(r'ISBN：\s*([\d-]+)', plain).group(1)
    edition = re.search(r'版次：\s*(\d+)', plain)
    title_edition = re.search(r'第[一二三四五六七八九十\d]+版', title)
    content = fetch(image_url)
    with Image.open(BytesIO(content)) as image:
        image = image.convert('RGB')
        image.thumbnail((600, 800))
        image.save(ROOT / 'covers' / (slug + '.jpg'), format='JPEG', quality=90)
    path = ROOT / 'covers' / (slug + '.jpg')
    result = dict(slug=slug, title=title, author=author, publisher='高等教育出版社',
        edition=('第' + edition.group(1) + '版') if edition else (title_edition.group() if title_edition else '以封面为准'), isbn=isbn,
        priceCents=price, category='donation' if price == 0 else ('reading' if slug == 'math-culture' else 'textbook'),
        cover='covers/' + slug + '.jpg', sourceUrl=source_url, imageUrl=image_url,
        retrievedAt=str(date.today()), sha256=sha256(path.read_bytes()).hexdigest())
    return result


if __name__ == '__main__':
    (ROOT / 'covers').mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(collect, SOURCES))
    (ROOT / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Archived {len(records)} verified publisher cover files.')
