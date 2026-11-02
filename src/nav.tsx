// Where the panel is: the web UI's routes (/spec/:ref?query, /changes, /diagnostics,
// /logs), kept in memory, with the few react-router hooks the pages use.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Nav {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const NavContext = createContext<Nav>({ path: '/spec', navigate: () => {} });

export function NavProvider({ initial = '/spec', children }: { initial?: string; children: ReactNode }) {
  const [path, setPath] = useState(initial);
  const navigate = useCallback((to: string) => setPath(to), []);
  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavigate() {
  return useContext(NavContext).navigate;
}

export function useLocation(): { pathname: string; search: string } {
  const { path } = useContext(NavContext);
  const q = path.indexOf('?');
  return q < 0 ? { pathname: path, search: '' } : { pathname: path.slice(0, q), search: path.slice(q) };
}

/** `ref` from `/spec/:ref`. */
export function useParams(): { ref?: string } {
  const { pathname } = useLocation();
  const m = /^\/spec\/([^/]+)/.exec(pathname);
  return m ? { ref: m[1] } : {};
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams, opts?: { replace?: boolean }) => void] {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = useCallback(
    (next: URLSearchParams) => {
      const s = next.toString();
      navigate(s ? `${pathname}?${s}` : pathname);
    },
    [navigate, pathname],
  );
  return [params, set];
}

export function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`rn-link ${className ?? ''}`}
      onClick={(e) => {
        onClick?.(e);
        navigate(to);
      }}
    >
      {children}
    </button>
  );
}
