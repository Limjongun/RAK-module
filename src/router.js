// Lightweight SPA Router (Hash-based for seamless Cloudflare Pages static hosting)

export class Router {
  constructor(routes, containerId = 'app') {
    this.routes = routes;
    this.container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
    this.currentCleanUp = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => this.resolve());
    }
  }

  start() {
    if (typeof window === 'undefined') return;
    if (!window.location.hash) {
      window.location.hash = '#/';
    } else {
      this.resolve();
    }
  }

  navigate(hashPath) {
    if (typeof window === 'undefined') return;
    window.location.hash = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  }

  resolve() {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.slice(1) || '/';
    const [pathPart, queryPart] = raw.split('?');
    const queryParams = new URLSearchParams(queryPart || '');

    let matchedRoute = null;
    let params = {};

    for (const route of this.routes) {
      const match = this.matchPath(route.path, pathPart);
      if (match) {
        matchedRoute = route;
        params = match;
        break;
      }
    }

    if (!matchedRoute) {
      // Default to 404 or first route
      matchedRoute = this.routes[0];
    }

    if (this.currentCleanUp && typeof this.currentCleanUp === 'function') {
      this.currentCleanUp();
      this.currentCleanUp = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      const cleanUp = matchedRoute.component({
        container: this.container,
        params,
        query: queryParams,
        router: this
      });

      if (typeof cleanUp === 'function') {
        this.currentCleanUp = cleanUp;
      }
    }
  }

  matchPath(pattern, path) {
    const patternSegments = pattern.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);

    if (patternSegments.length !== pathSegments.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i].startsWith(':')) {
        params[patternSegments[i].slice(1)] = decodeURIComponent(pathSegments[i]);
      } else if (patternSegments[i] !== pathSegments[i]) {
        return null;
      }
    }
    return params;
  }
}

