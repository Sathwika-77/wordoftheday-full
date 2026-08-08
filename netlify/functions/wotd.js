// netlify/functions/wotd.js
exports.handler = async function(event) {
  const WORDOFTHEDAY = process.env.WORDOFTHEDAY; // store your Wordnik API key here in Netlify
  const ALLOWED = process.env.ALLOWED_ORIGINS || '*';

  const defaultCorsHeaders = {
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // CORS preflight
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
    // Correct Wordnik endpoint for Word of the Day
    const url = `https://api.wordnik.com/v4/words.json/wordOfTheDay?date=${encodeURIComponent(date)}&api_key=${encodeURIComponent(WORDOFTHEDAY)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error('Wordnik returned error', res.status, text);
      return {
        statusCode: 502,
        headers: { ...defaultCorsHeaders, "Access-Control-Allow-Origin": allowOrigin },
        body: JSON.stringify({ error: 'wordnik_error', status: res.status, body: text })
      };
    }

    const data = await res.json();

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