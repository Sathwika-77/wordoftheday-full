// netlify/functions/wotd.js
// Netlify Function: Wordnik WOTD proxy.
// Set environment variable WORDOFTHEDAY in Netlify site settings.
// Optionally set ALLOWED_ORIGINS (comma-separated) to control CORS origins.

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.handler = async function(event) {
  const WORDOFTHEDAY = process.env.WORDOFTHEDAY;
  if (!WORDOFTHEDAY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server misconfigured: WORDOFTHEDAY not set' })
    };
  }

  // CORS handling
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = (event.headers && event.headers.origin) || '*';
  const headers = {
    'Access-Control-Allow-Origin': allowed.length > 0 ? (allowed.includes(origin) ? origin : '') : (origin || '*'),
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // If allowed origins configured and the request origin is not in the list -> reject
  if (allowed.length > 0 && origin && origin !== '*' && !allowed.includes(origin)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'CORS' }), headers };
  }

  try {
    const dateQuery = event.queryStringParameters && event.queryStringParameters.date
      ? `?date=${encodeURIComponent(event.queryStringParameters.date)}`
      : '';
    const base = 'https://api.wordnik.com/v4';

    // Word of the Day
    const wotdResp = await fetch(`${base}/words.json/wordOfTheDay${dateQuery}&api_key=${WORDOFTHEDAY}`, { timeout: 10000 });
    if (!wotdResp.ok) {
      const text = await wotdResp.text();
      return { statusCode: wotdResp.status, body: text, headers };
    }
    const wotd = await wotdResp.json();
    const word = wotd.word;

    // Parallel: audio, example, related words
    const [resAudio, resExample, resRelated] = await Promise.all([
      fetch(`${base}/word.json/${encodeURIComponent(word)}/audio?useCanonical=false&limit=50&api_key=${WORDOFTHEDAY}`),
      fetch(`${base}/word.json/${encodeURIComponent(word)}/topExample?useCanonical=false&api_key=${WORDOFTHEDAY}`),
      fetch(`${base}/word.json/${encodeURIComponent(word)}/relatedWords?useCanonical=false&limitPerRelationshipType=10&api_key=${WORDOFTHEDAY}`)
    ]);

    const audio = resAudio.ok ? await resAudio.json() : null;
    const topExample = resExample.ok ? await resExample.json() : null;
    const relatedWords = resRelated.ok ? await resRelated.json() : null;

    const payload = { ...wotd, audio, topExample, relatedWords };

    return {
      statusCode: 200,
      body: JSON.stringify(payload),
      headers
    };
  } catch (err) {
    console.error('Netlify function error', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'internal' }),
      headers
    };
  }
};