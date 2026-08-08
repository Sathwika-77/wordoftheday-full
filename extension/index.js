// extension/index.js
// Robust popup script for Word of the Day extension
// - Uses Netlify proxy (no API key in the extension)
// - Tolerant handling for examples, audio, synonyms/related words
// - Graceful DOM checks and helpful console logs for debugging

(() => {
  // Point to your Netlify function
  const BACKEND_URL = 'https://wordoftheday7.netlify.app/.netlify/functions/wotd';

  // Helper to safely select element
  const $ = sel => document.querySelector(sel);

  // Find an audio URL anywhere in an object (first match)
  function findAudioUrl(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const stack = [obj];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== 'object') continue;
      for (const k of Object.keys(cur)) {
        try {
          const v = cur[k];
          if (typeof v === 'string') {
            // common audio file extensions
            if (v.match(/\.(mp3|ogg|wav)(\?|$)/i)) return v;
            // sometimes fileUrl is present but without an extension
            if (/^https?:\/\/.+/.test(v) && (v.toLowerCase().includes('audio') || v.toLowerCase().includes('fileurl') || v.toLowerCase().includes('media'))) return v;
          } else if (typeof v === 'object' && v !== null && !seen.has(v)) {
            seen.add(v);
            stack.push(v);
          }
        } catch (e) {
          // ignore malformed values
        }
      }
    }
    return null;
  }

  // Render function: updates DOM safely
  async function render(data) {
    console.debug('WOTD response', data);

    const wordEl = $('#word');
    const defEl = $('#wordDef');
    const posEl = $('#partOfSpeech');
    const exampleEl = $('#example');      // single example
    const examplesListEl = $('#examples'); // optional <ul> for multiple examples
    const similarEl = $('#similar');     // <ul> for synonyms
    const audioElem = $('#pronunciation'); // expected <audio id="pronunciation">
    const audioPlayBtn = $('#audioPlay'); // optional play button

    // Basic fields
    const word = data && data.word ? data.word : '--';
    if (wordEl) wordEl.textContent = word;
    if (defEl) {
      const defText = (data.definitions && data.definitions[0] && (data.definitions[0].text || data.definitions[0].definition)) || '--';
      defEl.textContent = defText;
    }
    if (posEl) {
      const pos = (data.definitions && data.definitions[0] && data.definitions[0].partOfSpeech) || '';
      posEl.textContent = pos;
    }

    // Examples: prefer topExample, then examples[], then any examples found in other fields
    const examples = [];
    if (data.topExample && data.topExample.text) examples.push(data.topExample.text);
    if (Array.isArray(data.examples) && data.examples.length) {
      data.examples.forEach(e => {
        if (e && (e.text || e.example)) examples.push(e.text || e.example);
      });
    }
    // Add fallback: some payloads may have examples nested in other keys
    if (!examples.length && Array.isArray(data.definitions)) {
      data.definitions.forEach(d => {
        if (d && d.examples && Array.isArray(d.examples)) {
          d.examples.forEach(e => { if (e && (e.text || e.example)) examples.push(e.text || e.example); });
        }
      });
    }

    if (exampleEl) exampleEl.textContent = examples[0] || '--';
    if (examplesListEl) {
      examplesListEl.innerHTML = '';
      examples.slice(0, 5).forEach(ex => {
        const li = document.createElement('li');
        li.textContent = ex;
        examplesListEl.appendChild(li);
      });
      examplesListEl.style.display = examples.length ? 'block' : 'none';
    }

    // AUDIO: prefer audio present in WOTD payload, otherwise attempt to find any audio URL
    let audioUrl = null;
    if (data.audio && Array.isArray(data.audio) && data.audio.length) {
      // common keys: fileUrl or file_url
      const first = data.audio.find(a => a && (a.fileUrl || a.file_url));
      if (first) audioUrl = first.fileUrl || first.file_url || null;
    }
    if (!audioUrl) {
      // try to discover an audio URL anywhere in the payload
      audioUrl = findAudioUrl(data);
    }

    if (audioElem) {
      if (audioUrl) {
        audioElem.style.display = 'block';
        audioElem.controls = true;
        audioElem.src = audioUrl;
        // Do not autoplay; provide a play button if the browser blocks autoplay.
        if (audioPlayBtn) {
          audioPlayBtn.style.display = 'inline-block';
          audioPlayBtn.onclick = () => {
            audioElem.play().catch(err => console.warn('Audio play blocked', err));
          };
        }
      } else {
        audioElem.style.display = 'none';
        if (audioPlayBtn) audioPlayBtn.style.display = 'none';
      }
    }

    // SIMILAR (synonyms / related words)
    let synonyms = [];
    if (Array.isArray(data.relatedWords) && data.relatedWords.length) {
      data.relatedWords.forEach(r => {
        if (r && Array.isArray(r.words)) {
          if (/synonym/i.test(r.relationshipType || '')) {
            synonyms = synonyms.concat(r.words);
          }
        }
      });
      // fallback: if no synonyms matched, collect first words array available
      if (!synonyms.length) {
        const first = data.relatedWords.find(r => r && Array.isArray(r.words));
        if (first) synonyms = synonyms.concat(first.words);
      }
    }
    // Another fallback: some definitions may include synonyms
    if (!synonyms.length && Array.isArray(data.definitions)) {
      data.definitions.forEach(d => {
        if (d && Array.isArray(d.synonyms)) synonyms = synonyms.concat(d.synonyms);
      });
    }

    if (similarEl) {
      similarEl.innerHTML = '';
      const unique = [...new Set(synonyms)].slice(0, 6);
      if (unique.length) {
        unique.forEach(s => {
          const li = document.createElement('li');
          li.textContent = s;
          similarEl.appendChild(li);
        });
        similarEl.style.display = 'block';
      } else {
        similarEl.style.display = 'none';
      }
    }
  }

  // Main: fetch from BACKEND_URL and render
  async function popupWotD() {
    try {
      const today = (new Date()).toISOString().split('T')[0];
      const url = `${BACKEND_URL}?date=${encodeURIComponent(today)}`;

      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        // try to get response body for debugging
        let body = '';
        try { body = await res.text(); } catch (e) { body = '<no body>'; }
        throw new Error(`Backend returned ${res.status}: ${body}`);
      }

      const data = await res.json();
      await render(data);
    } catch (err) {
      console.error('popupWotD error', err);
      // graceful UI fallback
      const wordEl = $('#word');
      const defEl = $('#wordDef');
      if (wordEl) wordEl.textContent = '--';
      if (defEl) defEl.textContent = 'Error fetching word';
      // also hide audio and similar if present
      const audioElem = $('#pronunciation');
      if (audioElem) audioElem.style.display = 'none';
      const similarEl = $('#similar');
      if (similarEl) similarEl.style.display = 'none';
    }
  }

  window.addEventListener('load', popupWotD);
})();