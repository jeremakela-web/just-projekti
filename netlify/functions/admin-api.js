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

    if (action === 'getCustomers') {
      const [usersRes, profilesRes, bookingsRes] = await Promise.all([
        supaFetch('/auth/v1/admin/users?per_page=1000&page=1'),
        supaFetch('/rest/v1/profiles?select=*'),
        supaFetch('/rest/v1/bookings?select=user_id'),
      ]);
      const usersJson = await usersRes.json();
      const profiles = await profilesRes.json();
      const bookings = await bookingsRes.json();

      const users = usersJson.users || [];
      const profileMap = {};
      (Array.isArray(profiles) ? profiles : []).forEach(p => { profileMap[p.id] = p; });
      const bkCounts = {};
      (Array.isArray(bookings) ? bookings : []).forEach(b => {
        bkCounts[b.user_id] = (bkCounts[b.user_id] || 0) + 1;
      });

      const customers = users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        full_name: profileMap[u.id] ? profileMap[u.id].full_name : null,
        phone: profileMap[u.id] ? profileMap[u.id].phone : null,
        booking_count: bkCounts[u.id] || 0,
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customers),
      };
    }

    if (action === 'getCustomerBookings') {
      const { userId } = params;
      if (!userId) return { statusCode: 400, body: 'userId required' };
      const res = await supaFetch(`/rest/v1/bookings?user_id=eq.${userId}&select=*&order=created_at.desc`);
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.isArray(data) ? data : []),
      };
    }

    if (action === 'deleteCustomer') {
      const { userId } = params;
      if (!userId) return { statusCode: 400, body: 'userId required' };
      // Deleting from auth.users cascades to profiles and bookings
      const res = await supaFetch(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.text();
        return { statusCode: res.status, headers: { 'Content-Type': 'application/json' }, body: err };
      }
      return { statusCode: 200, body: '{}' };
    }

    return { statusCode: 400, body: 'Unknown action' };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
