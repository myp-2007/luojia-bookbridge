import { createContext, useContext } from 'react'
import type { User } from './auth-api'

export interface SessionState { user: User | null; loading: boolean; setUser: (user: User | null) => void; notice: (message: string) => void }
export const SessionContext = createContext<SessionState>({ user: null, loading: true, setUser: () => {}, notice: () => {} })
export const useSession = () => useContext(SessionContext)
