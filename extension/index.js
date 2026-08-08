// extension/index.js (popup)
const BACKEND_URL = 'https://wordoftheday7.netlify.app/.netlify/functions/wotd';

const popupWotD = async () => {
  try {
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    const res = await fetch(`${BACKEND_URL}?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error(`Failed to fetch from backend (${res.status})`);
    const data = await res.json();

    // Debug: log the whole response so you can inspect its shape in DevTools
    console.debug('WOTD response', data);

    // Basic fields
    const wordEl = document.querySelector('#word');
    const defEl = document.querySelector('#wordDef');
    const posEl = document.querySelector('#partOfSpeech');

    if (wordEl) wordEl.innerText = data.word || '--';
    if (defEl) defEl.innerText = (data.definitions && data.definitions[0] && (data.definitions[0].text || data.definitions[0].definition)) || '--';
    if (posEl) posEl.innerText = (data.definitions && data.definitions[0] && data.definitions[0].partOfSpeech) || '--';

    // Examples: prefer topExample, then examples[]
    const examplePrimaryEl = document.querySelector('#example'); // single example display
    const examplesListEl = document.querySelector('#examples'); // optional <ul> for multiple examples
    const examples = [];

    if (data.topExample && data.topExample.text) {
      examples.push(data.topExample.text);
    }
    if (Array.isArray(data.examples) && data.examples.length) {
      data.examples.forEach(e => {
        if (e && (e.text || e.example)) examples.push(e.text || e.example);
      });
    }
    // Some Wordnik payloads might include examples in other keys; log helps find them

    if (examplePrimaryEl) {
      examplePrimaryEl.innerText = examples[0] || '--';
    }
    if (examplesListEl) {
      examplesListEl.innerHTML = '';
      examples.slice(0, 5).forEach(ex => {
        const li = document.createElement('li');
        li.innerText = ex;
        examplesListEl.appendChild(li);
      });
      examplesListEl.style.display = examples.length ? 'block' : 'none';
    }

    // Audio: try common locations and tolerant ID search
    const audioCandidates = [
      data.audio && data.audio[0] && (data.audio[0].fileUrl || data.audio[0].file_url),
      // sometimes Wordnik returns 'fileUrl' or 'file_url'
      // fallback: some payloads include 'pronunciations' without audio; try none further
    ].filter(Boolean);

    const audioUrl = audioCandidates.length ? audioCandidates[0] : null;

    // find audio element by a few possible IDs used in different HTML versions
    const audioElem = document.querySelector('#pronunciation') || document.querySelector('#pronounciation') || document.querySelector('#audio') || document.querySelector('audio');

    if (audioElem) {
      if (audioUrl) {
        audioElem.style.display = 'block';
        // if it's an <audio> tag
        if (audioElem.tagName && audioElem.tagName.toLowerCase() === 'audio') {
          audioElem.src = audioUrl;
          audioElem.load();
        } else {
          // if it's e.g. <a id="audio"> link
          audioElem.href = audioUrl;
          audioElem.innerText = 'Listen';
        }
      } else {
        audioElem.style.display = 'none';
      }
    }

    // Similar words (synonyms) from relatedWords
    const similarEl = document.querySelector('#similar');
    if (similarEl) {
      similarEl.innerHTML = '';
      const related = Array.isArray(data.relatedWords) ? data.relatedWords : [];
      // try a few relationshipType spellings and case-insensitive match
      const synonymObj = related.find(x => x && x.relationshipType && x.relationshipType.toLowerCase().includes('synonym'));
      const synonyms = synonymObj && Array.isArray(synonymObj.words) ? synonymObj.words : [];
      synonyms.slice(0, 5).forEach(w => {
        const li = document.createElement('li');
        li.innerText = w;
        similarEl.appendChild(li);
      });
      similarEl.style.display = synonyms.length ? 'block' : 'none';
    }

  } catch (err) {
    console.error('popupWotD error', err);
    const wordEl = document.querySelector('#word');
    const defEl = document.querySelector('#wordDef');
    if (wordEl) wordEl.innerText = '--';
    if (defEl) defEl.innerText = 'Error fetching word of the day';
  }
};

window.addEventListener('load', popupWotD);