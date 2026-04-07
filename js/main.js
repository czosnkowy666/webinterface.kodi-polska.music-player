
  const RPC_PATH = '/jsonrpc';
  const player = document.getElementById("player");
  let selectedArtistsId = 0
  let selectedArtistsName = ""
  let historyBack = false

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
      if (album === null) {
        console.log("changing back artist name", artist, selectedArtistsName)
        artist = selectedArtistsName
        artistsId = selectedArtistsId
      }

      const art = document.createElement("span");
      art.textContent = artist
      art.className = 'title-artist no-wrap';
      art.onclick = () => loadAlbumsForArtist(artistsId, selectedArtistsName);
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

  function formatDuration(duration) {
    out = []
    if(duration > 3600) {
      hours = (duration - duration%3600)/3600
      out.push(hours)
      duration = duration - hours * 3600
    }
    if(duration > 60) {
      minutes = (duration - duration%60)/60
      out.push(minutes)
      duration = duration - minutes * 60
    }
    out.push(duration)
    
    return out.join(":")
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
        const duration = clone.querySelector('.list-duration')
        const lastPlayed = clone.querySelector('.list-lastplayed')

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
        if(row.duration) {
          duration.textContent = formatDuration(row.duration)
        }
        if(row.lastplayed) {
          lastPlayed.textContent = row.lastplayed
        }

        title.onclick = () => handleRowClick(row)
        panelList.appendChild(clone);
      });
      panels.appendChild(clonePanel)
  }

  function handleRowClick(row) {
    console.log(row)
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
    if (!historyBack) {
      history.pushState({ artist: "/"}, "Artists: /", "?artist=");
    }
    historyBack = false

    try {
      const res = await rpc('AudioLibrary.GetArtists', { 
        properties: ['thumbnail'], 
        limits: { start:0, end:5000 },
        sort:{method:"title",order:"ascending",ignorearticle:true} 
      });
      const list = (res && res.artists) || [];

      if (!list.length) { 
        setStatus('No artists')
        return
      }

      setList(list)

      setMainTitle('Artists', null, null)
      setStatus('')
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }
  }

  async function loadAlbumsForArtist(artistId, artistName) {
    setStatus('loading albums…')
    selectedArtistsId = artistId
    selectedArtistsName = artistName

    if (!historyBack) {
      history.pushState({ artist: artistId, artistName: artistName}, "Artists: " + artistId, "?artist=" + artistId);
    }
    historyBack = false


    try {
      const res = await rpc('AudioLibrary.GetAlbums', { properties: ['thumbnail','year','artist'], limits:{ start:0, end:1000 }, filter: {artistid: artistId} });
      const list = (res && res.albums) || [];
      
      if (!list.length) { setStatus('No albums'); return; }
      setList(list)

      setMainTitle(artistName, artistId, null)
      setStatus('')
    } catch (e) {
      console.error(e)
      setStatus('Error: ' + e.message)
    }
  }

  async function loadSongs(albumId, albumName, artistName) {
    setStatus('loading songs…')
    if (!historyBack) {
      history.pushState({ album: albumId, albumName: albumName, artistName: artistName }, "Album:" + albumId, "?album=" + albumId);
    }
    historyBack = false

    try {
      const params = { properties: ['title','file','thumbnail','duration','artist','artistid','album','track', "lastplayed"], limits:{ start:0, end:10000 }, filter: {albumid: albumId} };
      const res = await rpc('AudioLibrary.GetSongs', params);      
      const list = (res && res.songs) || [];

      if (!list.length) { setStatus('No songs'); return; }
      setList(list)
      
      setMainTitle(artistName, selectedArtistsId, albumName)

      setStatus('');
    } catch (e) {
      console.error(e); setStatus('Error: ' + e.message);
    }
  }

  async function playSong(songFile, title, artist, id) {
    if (player.duration > 0 && !player.paused) {
      document.querySelectorAll(".list-row.active").forEach(e => e.classList.remove('active'));  
    }
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
    if (!historyBack) {
      history.pushState({ playlist: "/"}, "Playlist: /", "?playlist=");
    }
    historyBack = false

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

  async function loadFiles(folderName, parentFolder) {
    if (!folderName) {
      folderName = ''
    }
    if (!parentFolder) {
      parentFolder = ''
    }

    setStatus('loading files…');
    console.log(parentFolder, folderName)
    if (!historyBack) {
      history.pushState({ files: parentFolder, name: folderName }, "Files:" + parentFolder, "?folder=" + encodeURI(parentFolder));
    }
    historyBack = false

    try {
      let res = {};
      let list = []
      if(!parentFolder) {
        res = await rpc('AudioLibrary.GetSources', {});
        list = (res && res.sources) || [];
        
      } else {        
        res = await rpc('Files.GetDirectory', {directory: parentFolder, media: "music", properties:["title","file","mimetype","thumbnail","artist", "lastplayed",'duration'],sort: {method:"file",order:"ascending"}});
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
    playNext(songId);
    const resGet = await rpc('AudioLibrary.GetSongDetails',  {"songid": Number(songId), "properties": ["album", "albumid", "artist","lastplayed","playcount"]});
    count = Number(resGet['songdetails']['playcount']) + 1
    const resSet = await rpc('AudioLibrary.SetSongDetails',  {"songid": Number(songId), "lastplayed": getDateTime(), "playcount": count});
  }

  player.onended = async () => {    
    bumpPlayCount(player.dataset.songid)
  };

  player.onstalled = () => {
    setStatus('Buffering... (Network stalled)');
  };

  player.onwaiting = () => {
    setStatus('Buffering... (Waiting for data)');
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

window.addEventListener("popstate", (event) => {
  if (!event.state) {
    return
  }
  console.log("going back", event.state)
  const state = event.state
  if ("artist" in state) {
    historyBack = true
    if(state['artist'] == '/') {
      loadArtists()
    } else {
      loadAlbumsForArtist(state["artist"], state["artistName"])
    }
    return
  }

  if ("album" in state) {
    historyBack = true
    loadSongs(state["album"])
    return
  }

  if ("playlist" in state) {
    historyBack = true
    loadPlaylist()
    return
  }

  if ("files" in state) {
    historyBack = true
    loadFiles("", state['files'])
    return
  }

});
