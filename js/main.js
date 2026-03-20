
  const RPC_PATH = '/jsonrpc';
  const player = document.getElementById("player");


  async function rpc(method, params = {}) {
    const r = await fetch(RPC_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);

    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    return j.result;
    
  }

  function cleanPanels() {
    const panels = document.getElementById('panels');
    panels.replaceChildren()
  }

  function setMainTitle(artist, artistsId, album) {
    console.log('setting title', artist, artistsId, album)

    title = document.querySelector('#main-title')
    while (title.firstChild) {
      title.removeChild(title.lastChild);
    }

    if (artist !== '' && artistsId === null) {
      title.textContent = artist
      return 
    }

    if (artist === '') {
      artist = '[Missing Tag]'
    }
    if (artist !== '' && artistsId !== null) {
      const art = document.createElement("span");
      art.textContent = artist
      art.className = 'title-artist no-wrap';
      art.onclick = () => loadAlbumsForArtist(artistsId, artist);
      title.appendChild(art)
    }

    if (album === null) {
      return
    }

    if (album === "") {
      album = '[Missing Tag]'      
    }

    const separator = document.createElement("span");
    separator.textContent = ' : '
    title.appendChild(separator)

    const alb = document.createElement("span");
    alb.textContent = album
    alb.className = 'title-album no-wrap';
    title.appendChild(alb)

  }

  function setList(list) {
      const templateRow = document.getElementById('tpl-list-row');
      const templatePanel = document.getElementById('tpl-panel');
      const clonePanel = document.importNode(templatePanel.content, true);
      const panelList = clonePanel.querySelector('.panel-list');
      cleanPanels();
      
      panelList.textContent = '';
      const panels = document.getElementById('panels');

      list.forEach(row => {
        const clone = document.importNode(templateRow.content, true);
        const title = clone.querySelector('.list-title')

        //console.log(row)

        title.textContent = formatLabel(row);
        if(row.id) {
          title.dataset.songId = row.id
        }
        if(row.songid) {
          title.dataset.songId = row.songid
        }
        if(row.file) {
          title.dataset.file = row.file
        }

        title.onclick = () => handleRowClick(row)
        panelList.appendChild(clone);
      });
      panels.appendChild(clonePanel)
  }

  function handleRowClick(row) {
    if (Object.hasOwn(row, 'songid')) {
      playSong(row.file, row.title, row.artist[0],row.songid)    
    } else if (Object.hasOwn(row, 'artistid')) {
      loadAlbumsForArtist(row.artistid, row.artist)
    } else if (Object.hasOwn(row, 'albumid')) {
      loadSongs(row.albumid, row.label, row.artist[0])
    } else if (Object.hasOwn(row, 'file')) {
      if (supportedFiles(row.file)) {
        playSong(row.file, row.title, row.artist[0], row.id)
      } else {
        loadFiles(row.label, row.file);
      }
    }

  }
  function formatLabel(row) {
    let label = row.label
    if (row.artist && Array.isArray(row.artist)) {
      label = row.artist[0] + ' - ' + label
    }

    return label    
  } 


  async function loadArtists() {
    setStatus('loading artists…');
    try {
      const res = await rpc('AudioLibrary.GetArtists', { 
        properties: ['thumbnail'], 
        limits: { start:0, end:5000 },
        sort:{method:"title",order:"ascending",ignorearticle:true} 
      });
      const list = (res && res.artists) || [];

      if (!list.length) { setStatus('No artists'); return; }
      setList(list)

      setMainTitle('Artists', null, null)
      setStatus('');
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }
  }

  async function loadAlbumsForArtist(artistId, artistName) {
    setStatus('loading albums…');
    try {
      const res = await rpc('AudioLibrary.GetAlbums', { properties: ['thumbnail','year','artist'], limits:{ start:0, end:1000 }, filter: {artistid: artistId} });
      const list = (res && res.albums) || [];
      
      if (!list.length) { setStatus('No albums'); return; }
      setList(list)

      setMainTitle(artistName, artistId, null)
      setStatus('');
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }
  }

  async function loadSongs(albumId, albumName, artistName) {
    setStatus('loading songs…');
    try {
      const params = { properties: ['title','file','thumbnail','duration','artist','artistid','album','track'], limits:{ start:0, end:10000 }, filter: {albumid: albumId} };
      const res = await rpc('AudioLibrary.GetSongs', params);      
      const list = (res && res.songs) || [];

      if (!list.length) { setStatus('No songs'); return; }
      setList(list)
      
      setMainTitle(artistName, 'TODO' /* artistId */, albumName)

      setStatus('');
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }
  }

  async function playSong(songFile, title, artist, id) {
    player.src = '/vfs/' + encodeURIComponent(songFile);
    player.dataset.title = title;
    player.dataset.artist = artist;
    player.dataset.file = songFile;
    player.dataset.songid = id;
    player.play();
    const currentRow =  document.querySelector('div:has(> h3[data-song-id="' + id + '"])');
    currentRow.classList.add('active')

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist, //TODO get artists name 
//        artwork: [
//          { src: artwork, sizes: "512x512", type: "image/png" }
//        ]
      });

      navigator.mediaSession.setActionHandler("play", () => player.play());
      navigator.mediaSession.setActionHandler("pause", () => player.pause());
      navigator.mediaSession.setActionHandler("stop", () => player.pause());    
    }

  }

  async function loadPlaylist() {
    // as kodi doesn't support actual playlist management and only have api to add or remove songs form current queue 
    // it need to be local in local storage playlist that could be exported to m3u and then uploaded to kodi
    // maybe it can read existing playlist from kodi though file api not it will be in rad only mode 
    setStatus('loading playlist…');
    cleanPanels();
    try {
      startFolder = 'special://musicplaylists/'
      res = await rpc('Files.GetDirectory', {directory: startFolder, media: "music", properties:["title","file","mimetype","thumbnail","artist"],sort: {method:"none",order:"ascending"}});
      const list = (res && res.files) || [];
      
      if (!list.length) { setStatus('No playlists'); return; }
      setList(list)

      setMainTitle("Playlists", null, null)

      setStatus('');
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }
  }

  function supportedFiles(file) {
    if (file.endsWith('.mp3')) {
      return true
    }
    if (file.endsWith('.opus')) {
      return true
    }
    if (file.endsWith('.flac')) {
      return true
    }
    
    return false
  }

  async function loadFiles(folderName, parnetFolder) {
    setStatus('loading files…');
    console.log(parnetFolder)

    try {
      let res = {};
      let list = []
      if(!parnetFolder) {
        res = await rpc('AudioLibrary.GetSources', {});
        list = (res && res.sources) || [];
        
      } else {        
        res = await rpc('Files.GetDirectory', {directory: parnetFolder, media: "music", properties:["title","file","mimetype","thumbnail","artist"],sort: {method:"none",order:"ascending"}});
        list = (res && res.files) || [];
      }

      if (!list.length) { setStatus('No folders/files'); return; }
      setList(list)

      setMainTitle('Files', null, null)

      setStatus('');
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }

  }


  function getDateTime() {
    const today = new Date();
    let day = today.getDate();
    let month = today.getMonth() + 1;
    let year = today.getFullYear();
    let hours = today.getHours();
    let miuntes = today.getMinutes();
    let seconds = today.getSeconds();
    day = day < 10 ? '0' + day : day;
    month = month < 10 ? '0' + month : month;
    hours = hours < 10 ? '0' + hours : hours;
    miuntes = miuntes < 10 ? '0' + miuntes : miuntes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    date = `${year}-${month}-${day} ${hours}:${miuntes}:${seconds}`
    return date
  }
  function playNext(songId) {
    console.log("current song was:" + songId)
    const currentRow =  document.querySelector('div:has(> h3[data-song-id="' + songId + '"])');
    currentRow.classList.remove('active')

    if (!currentRow) {
      console.log("missing current row")
      return
    }

    const nextRow = currentRow.nextElementSibling;
    if (!nextRow) {
      console.log("missing next row")
      return 
    }
    const songDataElem = nextRow.querySelector('h3')
    songDataElem.click();
    console.log("next song id: " + songDataElem.dataset.songId)
  }

  async function bumpPlayCount(songId) {
    if(!songId) {
      console.log("bumpPlayCount: no song id")
      return
    }

    const resGet = await rpc('AudioLibrary.GetSongDetails',  {"songid": Number(songId), "properties": ["album", "albumid", "artist","lastplayed","playcount"]});
    count = Number(resGet['songdetails']['playcount']) + 1
    const resSet = await rpc('AudioLibrary.SetSongDetails',  {"songid": Number(songId), "lastplayed": getDateTime(), "playcount": count});
    playNext(songId);
  }

  player.onended = async () => {    
    bumpPlayCount(player.dataset.songid)
  };

  player.onerror = () => {
    const err = player.error;
    if (err) {
      console.error("Audio error:", err.code);
      setStatus('Audio error (' + err.code + ')')
      /*
        1: MEDIA_ERR_ABORTED      – loading aborted by user
        2: MEDIA_ERR_NETWORK      – network error
        3: MEDIA_ERR_DECODE       – decoding error
        4: MEDIA_ERR_SRC_NOT_SUPPORTED – unsupported format or bad URL
      */
    }
  };

  function setStatus(t){ document.getElementById('status').textContent = t || ''; }

  document.addEventListener('DOMContentLoaded', () => {
    loadArtists();
    document.getElementById('nav-artist').addEventListener('click', loadArtists);
    document.getElementById('nav-playlist').addEventListener('click', loadPlaylist);
    document.getElementById('nav-file').addEventListener('click', (e) => { loadFiles() });
  });