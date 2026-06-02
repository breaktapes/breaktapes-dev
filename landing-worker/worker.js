// breaktapes.com (apex) worker.
//
// Previously a 301 redirect to app.breaktapes.com. Now a reverse-proxy of the
// app worker: breaktapes.com serves the same SPA, but the browser URL stays
// breaktapes.com, so the React app (App.tsx) detects the apex marketing host
// and renders the cinematic marketing landing instead of the login/app.
//
// app.breaktapes.com remains the login + app (logged-out shows the simple
// login screen). The marketing landing's Get Started / Sign in CTAs send the
// visitor to app.breaktapes.com/?auth=signup|signin.
export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.protocol = 'https:'
    url.hostname = 'app.breaktapes.com'
    url.port = ''
    // Proxy the request to the app worker. The Host header is derived from the
    // URL, so the app worker sees its own hostname. Browser URL stays breaktapes.com.
    return fetch(new Request(url.toString(), request))
  },
}
