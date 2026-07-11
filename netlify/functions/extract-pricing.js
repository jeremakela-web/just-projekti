exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let image, mediaType;
  try {
    ({ image, mediaType } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!image) {
    return { statusCode: 400, body: 'image required' };
  }

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const type = ALLOWED.includes(mediaType) ? mediaType : 'image/jpeg';

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
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

  const data = await res.json();

  if (!res.ok) {
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'api_error' }),
    };
  }

  const text = data.content?.[0]?.text ?? '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unclear: true, services: [] }),
    };
  }
};
