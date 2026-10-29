import type { Book } from '../types/books'

export const mockBooks: Book[] = [
  {
    id: 'book-001', title: '高等数学（第七版）上册', author: '同济大学数学系', publisher: '高等教育出版社', edition: '第七版', condition: '9成新 · 少量笔记', price: 22, category: 'textbook', status: 'available', tags: ['教材', '考研常用'], pickupPoint: '文理学部 · 图书馆附近', distance: '320m', coverText: '高等\n数学', coverColor: 'linear-gradient(145deg, #1d675a, #5ea37b)',
  },
  {
    id: 'book-002', title: 'C 语言程序设计（第三版）', author: '谭浩强', publisher: '清华大学出版社', edition: '第三版', condition: '8成新 · 无笔记', price: 20, category: 'textbook', status: 'reserved', tags: ['教材', '计算机'], pickupPoint: '工学部 · 二教', distance: '460m', coverText: 'C 语言\n程序设计', coverColor: 'linear-gradient(145deg, #2c6095, #81acd0)',
  },
  {
    id: 'book-003', title: '心理学与生活', author: '理查德·格里格', publisher: '人民邮电出版社', edition: '第十六版', condition: '9成新 · 有少量笔记', price: 28, category: 'reading', status: 'available', tags: ['课外读物', '经典'], pickupPoint: '枫园 · 食堂门口', distance: '780m', coverText: '心理学\n与生活', coverColor: 'linear-gradient(145deg, #653e62, #b0747e)',
  },
  {
    id: 'book-004', title: '中国近现代史纲要', author: '本书编写组', publisher: '高等教育出版社', edition: '2023 年版', condition: '全新 · 无笔记', price: 15, category: 'textbook', status: 'available', tags: ['教材', '通识课'], pickupPoint: '信息学部 · 四教', distance: '1.2km', coverText: '中国近现代史\n纲要', coverColor: 'linear-gradient(145deg, #7a463e, #c68b65)',
  },
  {
    id: 'book-005', title: '山月记', author: '中岛敦', publisher: '江苏凤凰文艺出版社', edition: '精选版', condition: '9成新 · 无笔记', price: 12, category: 'reading', status: 'available', tags: ['文学', '交换'], pickupPoint: '珞珈山 · 樱顶', distance: '980m', coverText: '山月记', coverColor: 'linear-gradient(145deg, #59785d, #b8a46b)',
  },
]
