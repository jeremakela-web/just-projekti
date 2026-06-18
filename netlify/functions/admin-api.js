const SUPA_URL = 'https://mebuynheutnegvvofnrl.supabase.co';

async function supaFetch(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return fetch(`${SUPA_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { action, adminPassword, ...params } = body;

  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    await new Promise(r => setTimeout(r, 500));
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    if (action === 'getPartners') {
      const res = await supaFetch('/rest/v1/partners?select=*&order=created_at.desc');
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      };
    }

    if (action === 'toggleActive') {
      const { id, active } = params;
      await supaFetch(`/rest/v1/partners?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      });
      return { statusCode: 200, body: '{}' };
    }

    if (action === 'deletePartner') {
      const { id } = params;
      await supaFetch(`/rest/v1/partners?id=eq.${id}`, { method: 'DELETE' });
      return { statusCode: 200, body: '{}' };
    }

    return { statusCode: 400, body: 'Unknown action' };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
