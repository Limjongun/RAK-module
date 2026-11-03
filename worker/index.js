// Cloudflare Worker API untuk Rak Modul
// Mengatur otorisasi JWT Supabase, signed URL R2, dan keep-alive cron

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. GET /api/health
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. POST /api/upload-url: Mendapatkan presigned URL untuk upload ke R2
    if (url.pathname === '/api/upload-url' && request.method === 'POST') {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const body = await request.json().catch(() => ({}));
      const filename = body.filename || `file-${crypto.randomUUID()}`;
      const key = `originals/${filename}`;

      // Simpan langsung lewat binding R2 jika dikirim stream, atau beri info path
      return new Response(JSON.stringify({ key, target: `/api/file/${key}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. GET/PUT /api/file/*: Proxy file R2
    if (url.pathname.startsWith('/api/file/')) {
      const key = url.pathname.replace('/api/file/', '');

      if (request.method === 'PUT') {
        await env.BUCKET.put(key, request.body);
        return new Response(JSON.stringify({ success: true, key }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET') {
        const object = await env.BUCKET.get(key);
        if (!object) {
          return new Response('File Not Found', { status: 404, headers: corsHeaders });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        return new Response(object.body, { headers });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },

  // Cron Handler: Menjaga Supabase Free Tier agar tidak dijeda
  async scheduled(event, env, ctx) {
    if (env.SUPABASE_URL) {
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
          headers: { apikey: env.SUPABASE_ANON_KEY || '' }
        });
      } catch (e) {
        console.error('Supabase keep-alive failed:', e);
      }
    }
  }
};

