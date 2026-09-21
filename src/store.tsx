import { createContext, useContext, useState, type ReactNode } from 'react';
import { initialState, type AppState, type User } from './domain';

const KEY = 'digital-heroes-state';
function load(): AppState { try { const value = localStorage.getItem(KEY); return value ? JSON.parse(value) : initialState; } catch { return initialState; } }
const StoreContext = createContext<{ state: AppState; setUser: (user: User | null) => void; notify: (message: string) => void }>({ state: initialState, setUser: () => {}, notify: () => {} });
export function StoreProvider({ children }: { children: ReactNode }) { const [state, setState] = useState<AppState>(load); const update = (next: AppState) => { setState(next); localStorage.setItem(KEY, JSON.stringify(next)); }; return <StoreContext.Provider value={{ state, setUser: user => update({ ...state, user }), notify: message => { const next = { ...state, notice: message }; update(next); window.setTimeout(() => update({ ...next, notice: null }), 3200); } }}>{children}</StoreContext.Provider>; }
export function useStore() { return useContext(StoreContext); }
