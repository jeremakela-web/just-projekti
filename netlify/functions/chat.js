const SYSTEM_PROMPT = `Olet Just.-alustan ystävällinen asiakaspalveluassistentti. Vastaat sekä suomeksi että englanniksi asiakkaan kielen mukaan. Ole lyhyt ja selkeä.

JUST. ON:
- Digitaalinen palvelualusta joka yhdistää asiakkaat ja laadunvarmistetut ammattilaiset
- Varaukset: justapp.fi | Info: getjust.fi
- Ylläpitäjä: Kansallisvaranto Oy, Turku

PALVELUT (aktiiviset):
- Autopesu: alkaen 20€ – ulko/sisäpesu, vahaus, pinnoitus, hakupalvelu
- Renkaanvaihto: henkilöauto 25€, pakettiauto 30€, rengashotelli 80€/kausi
Tulossa: Kodinsiivous, Autohuolto, Pintakäsittely, Pihatyöt, Rakennusala

MITEN VARAUS TOIMII:
1. Mene justapp.fi
2. Valitse palvelu ja tekijä (näet kuvan + arvostelut etukäteen)
3. Valitse aika kalenterista
4. Maksa käteisellä tai kortilla työn jälkeen
5. Saat SMS-linkin arviointilomakkeeseen

OHJAUSLOGIIKKA – noudata aina:
- Yleiset kysymykset palveluista ja hinnoista → vastaa itse
- Varaukset → ohjaa aina justapp.fi:hin
- Erikoistoiveet tai palvelua ei listalla → "Varaa aika justapp.fi:ssä ja kirjoita erikoistoiveesi Lisätiedot-kenttään – tekijä ottaa yhteyttä ennen työtä"
- Reklamaatiot, laskutus, tekniset ongelmat → info.getjust@gmail.com
- ÄLÄ koskaan ohjaa info.getjust@gmail.com:iin varaus- tai palvelukyselyissä

KUMPPANUUSHINNOITTELU:
Free: 0€/kk, 12% provisio | Pro: 29€/kk, 5% | Business: 79€/kk, 2% | Enterprise: 199€/kk, 0%

PERUUTUS: 24h+ ennen = ilmainen | alle 24h = 50% | ei saavu = 100%`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let messages;
  try {
    ({ messages } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: 'messages array required' };
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return { statusCode: res.status, body: JSON.stringify(data) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply: data.content?.[0]?.text ?? '' }),
  };
};
