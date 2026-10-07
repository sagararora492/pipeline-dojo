import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            pipeline-dojo
          </Link>
          <nav aria-label="Main">
            <NavLink to="/sql">SQL</NavLink>
            <NavLink to="/progress">Progress</NavLink>
            <a href="https://github.com/sagararora492/pipeline-dojo">GitHub</a>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap">
        <Outlet />
      </main>
      <footer className="site-footer wrap">
        Everything runs in your browser. Progress is saved on this device only.
      </footer>
    </>
  );
}
