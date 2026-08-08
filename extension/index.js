// index.js (popup)
const BACKEND_URL = 'https://verdant-monstera-38eaa2.netlify.app/.netlify/functions/wotd';

const popupWotD = async () => {
  try {
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    const res = await fetch(`${BACKEND_URL}?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error('Failed to fetch from backend');
    const data = await res.json();

    document.querySelector('#word').innerText = data.word || '--';
    document.querySelector('#wordDef').innerText = (data.definitions && data.definitions[0] && data.definitions[0].text) || '--';
    document.querySelector('#partOfSpeech').innerText = (data.definitions && data.definitions[0] && data.definitions[0].partOfSpeech) || '--';
    document.querySelector('#example').innerText = (data.topExample && data.topExample.text) || '--';

    const audioElem = document.querySelector('#pronounciation');
    if (data.audio && data.audio[0] && data.audio[0].fileUrl) {
      audioElem.style.display = 'block';
      audioElem.src = data.audio[0].fileUrl;
    } else {
      audioElem.style.display = 'none';
    }

    const similarEl = document.querySelector('#similar');
    similarEl.innerHTML = '';
    const synonymObj = (data.relatedWords || []).find(x => x.relationshipType === 'synonym');
    const synonyms = synonymObj ? synonymObj.words : [];
    synonyms.slice(0, 3).forEach(w => {
      const li = document.createElement('li');
      li.innerText = w;
      similarEl.appendChild(li);
    });
  } catch (err) {
    console.error('popupWotD', err);
    document.querySelector('#word').innerText = '--';
    document.querySelector('#wordDef').innerText = 'Error fetching word of the day';
  }
};

window.addEventListener('load', popupWotD);