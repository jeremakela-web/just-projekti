exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let image, mediaType;
  try {
    ({ image, mediaType } = JSON.parse(event.body));
  } catch (e) {
    console.error('extract-pricing: JSON parse error', e.message);
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!image) {
    return { statusCode: 400, body: 'image required' };
  }

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const type = ALLOWED.includes(mediaType) ? mediaType : 'image/jpeg';

  console.log('extract-pricing: image size (base64 chars)', image.length, 'type', type);

  const prompt = `Analysoi tämä hinnastokuva. Palauta JSON-muodossa lista palveluista ja niiden hinnoista.

Palauta VAIN JSON, ei muuta tekstiä:
{
  "services": [
    {
      "name": "palvelun nimi",
      "price": "hinta numeroina (esim. 50)",
      "unit": "yksikkö (esim. /auto, /tunti, /m2)",
      "description": "lyhyt kuvaus"
    }
  ]
}

Jos kuvasta ei löydy selkeitä hintoja tai kuva ei ole hinnasto, palauta:
{"unclear": true, "services": []}`;

  let res, data;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: type, data: image },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    data = await res.json();
  } catch (e) {
    console.error('extract-pricing: fetch error', e.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'fetch_error', detail: e.message }),
    };
  }

  if (!res.ok) {
    console.error('extract-pricing: Anthropic API error', res.status, JSON.stringify(data));
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'api_error', status: res.status, detail: data }),
    };
  }

  const text = data.content?.[0]?.text ?? '';
  console.log('extract-pricing: raw response', text.slice(0, 200));

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json in response');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (e) {
    console.error('extract-pricing: JSON parse of model response failed', e.message, text.slice(0, 300));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unclear: true, services: [] }),
    };
  }
};
