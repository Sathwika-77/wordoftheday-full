const popupWotD = async () => {
    try {
        var today = new Date();
        var date = today.toISOString().split('T')[0];
        // var date = '2022-04-04';
        console.log(date);

        
        const res = await fetch(`https://api.wordnik.com/v4/words.json/wordOfTheDay?date=${date}&api_key=rs8exkozlx5qoe6we3arcvx3us22jlrec5jo2t4v152fh87r5`);

        const data = await res.json();

        const word = document.querySelector('#word');
        word.innerHTML = data.word;

        const resAudio = await fetch(`https://api.wordnik.com/v4/word.json/${data.word}/audio?useCanonical=false&limit=50&api_key=rs8exkozlx5qoe6we3arcvx3us22jlrec5jo2t4v152fh87r5`);
        const resExample = await fetch(`https://api.wordnik.com/v4/word.json/${data.word}/topExample?useCanonical=false&api_key=rs8exkozlx5qoe6we3arcvx3us22jlrec5jo2t4v152fh87r5`);
        const resSimilar = await fetch(`https://api.wordnik.com/v4/word.json/${data.word}/relatedWords?useCanonical=false&limitPerRelationshipType=10&api_key=rs8exkozlx5qoe6we3arcvx3us22jlrec5jo2t4v152fh87r5`);

        const dataExample = await resExample.json();
        

        const wordDefs = document.querySelector('#wordDef');
        wordDefs.innerHTML = data.definitions[0].text;

        const partOfSpeech = document.querySelector('#partOfSpeech');
        partOfSpeech.innerHTML = data.definitions[0].partOfSpeech;

        const example = document.querySelector('#example');
        example.innerHTML = dataExample.text;

        

        // Audio
        try {
            const dataAudio = await resAudio.json();
            const audio = document.querySelector('#pronounciation');
            audio.src = dataAudio[0].fileUrl;
            audio.play();
        } catch (audioError) {
            // If audio is not available, hide the audio element
            const audio = document.querySelector('#pronounciation');
            audio.style.display = 'none';
        }

        try {
            const dataSimilar = await resSimilar.json();
            const similar = document.querySelector('#similar');
            similar.innerHTML = '';

            const synonymWords =await dataSimilar.find(item => item.relationshipType === "synonym");
            const synonymList = synonymWords ? synonymWords.words : [];

            synonymList.slice(0, 3).forEach(word => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `${word}`;
                similar.appendChild(listItem);
        });
        } catch (similarError) {
            // If similar is not available, hide the similar element
            const similar = document.querySelector('#similar');
            similar.innerHTML = '--';
        }


    } catch (error) {
    }


};

window.addEventListener("load", () => {
    popupWotD();
});