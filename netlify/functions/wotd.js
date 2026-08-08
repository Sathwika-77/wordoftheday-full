// netlify/functions/wotd.js
// Fetch Wordnik WordOfTheDay and enrich with audio, relatedWords, topExample
exports.handler = async function(event) {
  const WORDOFTHEDAY = process.env.WORDOFTHEDAY; // your Wordnik API key in Netlify env
  const ALLOWED = process.env.ALLOWED_ORIGINS || '*';

  const defaultCorsHeaders = {
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // Handle CORS preflight
  if (event && event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...defaultCorsHeaders,
        "Access-Control-Allow-Origin": ALLOWED
      },
      body: ''
    };
  }

  if (!WORDOFTHEDAY) {
    console.error('Missing WORDOFTHEDAY env var');
    return {
      statusCode: 500,
      headers: { ...defaultCorsHeaders, "Access-Control-Allow-Origin": ALLOWED },
      body: JSON.stringify({ error: 'WORDOFTHEDAY not configured' })
    };
  }

  const requestOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  let allowOrigin = ALLOWED;
  if (ALLOWED !== '*') {
    const allowedList = ALLOWED.split(',').map(s => s.trim()).filter(Boolean);
    allowOrigin = allowedList.includes(requestOrigin) ? requestOrigin : allowedList[0] || 'null';
  }

  const date = (event.queryStringParameters && event.queryStringParameters.date) || new Date().toISOString().slice(0,10);

  try {
    // 1) Fetch the Word of the Day
    const wotdUrl = `https://api.wordnik.com/v4/words.json/wordOfTheDay?date=${encodeURIComponent(date)}&api_key=${encodeURIComponent(WORDOFTHEDAY)}`;
    const wotdResp = await fetch(wotdUrl);
    if (!wotdResp.ok) {
      const txt = await wotdResp.text().catch(()=>'');
      console.error('Wordnik WOTD returned', wotdResp.status, txt);
      return {
        statusCode: 502,
        headers: { ...defaultCorsHeaders, "Access-Control-Allow-Origin": allowOrigin },
        body: JSON.stringify({ error: 'wordnik_wotd_error', status: wotdResp.status, body: txt })
      };
    }
    const data = await wotdResp.json();

    // If no word found, return as-is
    const word = data && data.word;
    if (!word) {
      return {
        statusCode: 200,
        headers: { ...defaultCorsHeaders, "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" },
        body: JSON.stringify(data)
      };
    }

    // 2) Enrich with audio, relatedWords, topExample in parallel (don't fail whole response if one fails)
    const endpoints = {
      audio: `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/audio?useCanonical=false&limit=50&api_key=${encodeURIComponent(WORDOFTHEDAY)}`,
      relatedWords: `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/relatedWords?useCanonical=false&limitPerRelationshipType=10&api_key=${encodeURIComponent(WORDOFTHEDAY)}`,
      topExample: `https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/topExample?useCanonical=false&api_key=${encodeURIComponent(WORDOFTHEDAY)}`
    };

    const fetchWithSafeJson = async (url, key) => {
      try {
        const r = await fetch(url);
        if (!r.ok) {
          const t = await r.text().catch(()=>'');
          console.warn(`${key} endpoint returned ${r.status}`, t);
          return null;
        }
        const json = await r.json().catch(()=>null);
        return json;
      } catch (err) {
        console.warn(`Error fetching ${key}`, err && (err.stack || err));
        return null;
      }
    };

    const [audioData, relatedData, topExampleData] = await Promise.all([
      fetchWithSafeJson(endpoints.audio, 'audio'),
      fetchWithSafeJson(endpoints.relatedWords, 'relatedWords'),
      fetchWithSafeJson(endpoints.topExample, 'topExample')
    ]);

    // Attach enrichments (only if present)
    if (audioData) data.audio = audioData;
    if (relatedData) data.relatedWords = relatedData;
    // Wordnik topExample returns an object; ensure we place it under topExample
    if (topExampleData) data.topExample = topExampleData;

    // 3) Return combined payload
    return {
      statusCode: 200,
      headers: { ...defaultCorsHeaders, "Access-Control-Allow-Origin": allowOrigin, "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('Unhandled exception in wotd function:', err && (err.stack || err));
    return {
      statusCode: 500,
      headers: { ...defaultCorsHeaders, "Access-Control-Allow-Origin": allowOrigin },
      body: JSON.stringify({ error: 'internal', message: err && err.message ? err.message : 'unknown' })
    };
  }
};