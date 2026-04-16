class MusicPLayer {
  constructor() {
    this.RPC_PATH = '/jsonrpc';
    this.player = document.getElementById("player");
    this.selectedArtistsId = 0;
    this.selectedArtistsName = "";
    this.historyBack = false;
    this.currentList = [];
  }

  init() {
    this.player.onplay = async () => {
      this.songStatusUpdate(1)
    };

    this.player.onpause = async () => {
      this.songStatusUpdate(0)
    };

    this.player.onended = async () => {
      this.bumpPlayCount(this.player.dataset.songid)
    };

    this.player.onstalled = () => {
      this.setStatus('Buffering... (Network stalled)');
      console.log("stalled buffer resetting");
      const resumeAt = this.player.currentTime;
      const currentUrl = this.player.src;
    
      this.player.pause();
      this.player.src = ""; 
      this.player.load(); // Force the browser to reset its internal state
    
      // 3. Re-assign the URL and seek
      this.player.src = currentUrl; 
      this.player.load();
      this.player.currentTime = resumeAt;
      
      // 4. Restart playback
      this.player.play().catch(e => console.error("Auto-play blocked:", e));      
    };
/*
    this.player.onwaiting = () => {
      this.setStatus('Buffering... (Waiting for data)');
    };
*/
    this.player.onerror = () => {
      const err = this.player.error;
      if (err) {
        console.error("Audio error:", err.code);
        this.setStatus('Audio error (' + err.code + ')')
        /*
          1: MEDIA_ERR_ABORTED      – loading aborted by user
          2: MEDIA_ERR_NETWORK      – network error
          3: MEDIA_ERR_DECODE       – decoding error
          4: MEDIA_ERR_SRC_NOT_SUPPORTED – unsupported format or bad URL
        */
      }
    };
    document.getElementById('nav-artist').addEventListener('click', (e) => { this.loadArtists() });
    document.getElementById('nav-playlist').addEventListener('click', (e) => { this.loadPlaylist() });
    document.getElementById('nav-file').addEventListener('click', (e) => { this.loadFiles() });

    window.addEventListener("popstate", (event) => { this.historyHandler(event) });
  }

  async rpc(method, params = {}) {
    const r = await fetch(this.RPC_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);

    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    return j.result;

  }

  cleanPanels() {
    const panels = document.getElementById('panels');
    panels.replaceChildren()
  }

  setMainTitle(artist, artistsId, album) {
    console.log('setting title', artist, artistsId, album)

    const title = document.querySelector('#main-title')
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
        console.log("changing back artist name", artist, this.selectedArtistsName)
        artist = this.selectedArtistsName
        artistsId = this.selectedArtistsId
      }

      const art = document.createElement("span");
      art.textContent = artist
      art.className = 'title-artist no-wrap';
      art.onclick = () => loadAlbumsForArtist(artistsId, this.selectedArtistsName);
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

  formatDuration(duration) {
    let out = []
    if (duration > 3600) {
      const hours = (duration - duration % 3600) / 3600
      out.push(hours)
      duration = duration - hours * 3600
    }
    if (duration > 60) {
      const minutes = (duration - duration % 60) / 60
      out.push(minutes)
      duration = duration - minutes * 60
    }
    out.push(duration)

    return out.join(":")
  }

  setList(list) {
    const templateRow = document.getElementById('tpl-list-row');
    const templatePanel = document.getElementById('tpl-panel');
    const clonePanel = document.importNode(templatePanel.content, true);
    const panelList = clonePanel.querySelector('.panel-list');
    this.cleanPanels();

    panelList.textContent = '';
    const panels = document.getElementById('panels');

    list.forEach(row => {
      const clone = document.importNode(templateRow.content, true);
      const title = clone.querySelector('.list-title')
      const duration = clone.querySelector('.list-duration')
      const lastPlayed = clone.querySelector('.list-lastplayed')

      //console.log(row)

      title.textContent = this.formatLabel(row);
      if (row.id) {
        title.dataset.songId = row.id
      }
      if (row.songid) {
        title.dataset.songId = row.songid
      }
      if (row.file) {
        title.dataset.file = row.file
      }
      if (row.duration) {
        duration.textContent = this.formatDuration(row.duration)
      }
      if (row.lastplayed) {
        lastPlayed.textContent = row.lastplayed
      }

      title.onclick = () => this.handleRowClick(row)
      panelList.appendChild(clone);
    });
    panels.appendChild(clonePanel)
  }

  handleRowClick(row) {
    console.log(row)
    if (Object.hasOwn(row, 'songid')) {
      this.playSong(row.file, row.title, row.artist[0], row.songid)
    } else if (Object.hasOwn(row, 'artistid')) {
      this.loadAlbumsForArtist(row.artistid, row.artist)
    } else if (Object.hasOwn(row, 'albumid')) {
      this.loadSongs(row.albumid, row.label, row.artist[0])
    } else if (Object.hasOwn(row, 'file')) {
      if (this.supportedFiles(row.file)) {
        this.playSong(row.file, row.title, row.artist[0], row.id)
      } else {
        this.loadFiles(row.label, row.file);
      }
    }

  }

  formatLabel(row) {
    let label = row.label
    if (row.artist && Array.isArray(row.artist)) {
      label = row.artist[0] + ' - ' + label
    }

    return label
  }

  async loadArtists() {
    this.setStatus('loading artists…');
    if (!this.historyBack) {
      history.pushState({ artist: "/" }, "Artists: /", "?artist=");
    }
    this.historyBack = false

    try {
      const res = await this.rpc('AudioLibrary.GetArtists', {
        properties: ['thumbnail'],
        limits: { start: 0, end: 5000 },
        sort: { method: "title", order: "ascending", ignorearticle: true }
      });
      const list = (res && res.artists) || [];

      if (!list.length) {
        this.setStatus('No artists')
        return
      }

      this.setList(list)

      this.setMainTitle('Artists', null, null)
      this.setStatus('')
    } catch (e) {
      console.error(e); this.setStatus('Error: ' + e.message);
    }
  }

  async loadAlbumsForArtist(artistId, artistName) {
    this.setStatus('loading albums…')
    this.selectedArtistsId = artistId
    this.selectedArtistsName = artistName

    if (!this.historyBack) {
      history.pushState({ artist: artistId, artistName: artistName }, "Artists: " + artistId, "?artist=" + artistId);
    }
    this.historyBack = false

    try {
      const res = await this.rpc('AudioLibrary.GetAlbums', { properties: ['thumbnail', 'year', 'artist'], limits: { start: 0, end: 1000 }, filter: { artistid: artistId } });
      const list = (res && res.albums) || [];

      if (!list.length) { this.setStatus('No albums'); return; }
      this.setList(list)

      this.setMainTitle(artistName, artistId, null)
      this.setStatus('')
    } catch (e) {
      console.error(e)
      this.setStatus('Error: ' + e.message)
    }
  }

  async loadSongs(albumId, albumName, artistName) {
    this.setStatus('loading songs…')
    if (!this.historyBack) {
      history.pushState({ album: albumId, albumName: albumName, artistName: artistName }, "Album:" + albumId, "?album=" + albumId);
    }
    this.historyBack = false

    try {
      const params = { properties: ['title', 'file', 'thumbnail', 'duration', 'artist', 'artistid', 'album', 'track', "lastplayed", 'playcount'], limits: { start: 0, end: 10000 }, filter: { albumid: albumId } };
      const res = await this.rpc('AudioLibrary.GetSongs', params);
      const list = (res && res.songs) || [];

      if (!list.length) { this.setStatus('No songs'); return; }
      this.setList(list)

      this.setMainTitle(artistName, this.selectedArtistsId, albumName)

      this.setStatus('');
    } catch (e) {
      console.error(e); this.setStatus('Error: ' + e.message);
    }
  }

  playSong(songFile, title, artist, id) {
    if (this.player.duration > 0 && !this.player.paused) {
      document.querySelectorAll(".list-row.active").forEach(e => e.classList.remove('active'));
    }
    if (this.player.duration > 0 && this.player.paused) {
      document.querySelectorAll(".list-row.paused").forEach(e => e.classList.remove('paused'));
    }
    try {
      this.player.src = '/vfs/' + encodeURIComponent(songFile);
      this.player.dataset.title = title;
      this.player.dataset.artist = artist;
      this.player.dataset.file = songFile;
      this.player.dataset.songid = id;
      this.songStatusUpdate(1);
      this.player.play();

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title,
          artist: artist,
          //        artwork: [
          //          { src: artwork, sizes: "512x512", type: "image/png" }
          //        ]
        });

        navigator.mediaSession.setActionHandler("play", () => this.player.play());
        navigator.mediaSession.setActionHandler("pause", () => this.player.pause());
        navigator.mediaSession.setActionHandler("stop", () => this.player.pause());
      }      
    } catch (error) {
      console.error("play song error");
      console.error(error.message);
    }
  }

  async loadPlaylist() {
    // as kodi doesn't support actual playlist management and only have api to add or remove songs form current queue 
    // it need to be local in local storage playlist that could be exported to m3u and then uploaded to kodi
    // maybe it can read existing playlist from kodi though file api not it will be in rad only mode 
    this.setStatus('loading playlist…');
    if (!this.historyBack) {
      history.pushState({ playlist: "/" }, "Playlist: /", "?playlist=");
    }
    this.historyBack = false

    this.cleanPanels();
    try {
      const startFolder = 'special://musicplaylists/'
      const res = await this.rpc('Files.GetDirectory', { directory: startFolder, media: "music", properties: ["title", "file", "mimetype", "thumbnail", "artist"], sort: { method: "none", order: "ascending" } });
      const list = (res && res.files) || [];

      if (!list.length) { this.setStatus('No playlists'); return; }
      this.setList(list)

      this.setMainTitle("Playlists", null, null)

      this.setStatus('');
    } catch (e) {
      console.error(e); this.setStatus('Error: ' + e.message);
    }
  }

  supportedFiles(file) {
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

  async loadFiles(folderName, parentFolder) {
    if (!folderName) {
      folderName = ''
    }
    if (!parentFolder) {
      parentFolder = ''
    }

    this.setStatus('loading files…');
    console.log(parentFolder, folderName)
    if (!this.historyBack) {
      history.pushState({ files: parentFolder, name: folderName }, "Files:" + parentFolder, "?folder=" + encodeURI(parentFolder));
    }
    this.historyBack = false

    try {
      let res = {};
      let list = []
      if (!parentFolder) {
        res = await this.rpc('AudioLibrary.GetSources', {});
        list = (res && res.sources) || [];

      } else {
        res = await this.rpc('Files.GetDirectory', { directory: parentFolder, media: "music", properties: ["title", "file", "mimetype", "thumbnail", "artist", "lastplayed", 'playcount', 'duration'], sort: { method: "file", order: "ascending" } });
        list = (res && res.files) || [];
      }

      if (!list.length) { this.setStatus('No folders/files'); return; }
      this.setList(list)

      this.setMainTitle('Files', null, null)

      this.setStatus('');
    } catch (e) {
      console.error(e); this.setStatus('Error: ' + e.message);
    }

  }


  getDateTime() {
    const today = new Date();
    let day = today.getDate();
    let month = today.getMonth() + 1;
    let year = today.getFullYear();
    let hours = today.getHours();
    let minutes = today.getMinutes();
    let seconds = today.getSeconds();
    day = String(day).padStart(2, '0');
    month = String(month).padStart(2, '0');
    hours = String(hours).padStart(2, '0');
    minutes = String(minutes).padStart(2, '0');
    seconds = String(seconds).padStart(2, '0');
    const date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    return date
  }

  async playNext(songId) {
    console.log("current song was:" + songId)
    const currentRow = document.querySelector('div:has(> h3[data-song-id="' + songId + '"])');
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

  async bumpPlayCount(songId) {
    if (!songId) {
      console.log("bumpPlayCount: no song id")
      return
    }
    this.playNext(songId);
    const resGet = await this.rpc('AudioLibrary.GetSongDetails', { "songid": Number(songId), "properties": ["album", "albumid", "artist", "lastplayed", "playcount"] });
    const count = Number(resGet['songdetails']['playcount']) + 1
    const resSet = await this.rpc('AudioLibrary.SetSongDetails', { "songid": Number(songId), "lastplayed": this.getDateTime(), "playcount": count });
  }

  songStatusUpdate(status) {    
    const id = this.player.dataset.songid;
    const currentRow = document.querySelector('div:has(> h3[data-song-id="' + id + '"])');
    if (status == 0) {
      currentRow.classList.remove('active');
      currentRow.classList.add('paused');
      return;
    }

    if (status == 1) {
      currentRow.classList.remove('paused');
      currentRow.classList.add('active');
      return true;
    }

  }

  async setStatus(t) {
    document.getElementById('status').textContent = t || '';
  }

  historyHandler(event) {
    if (!event.state) {
      return
    }
    console.log("going back", event.state)
    const state = event.state
    if ("artist" in state) {
      this.historyBack = true
      if (state['artist'] == '/') {
        this.loadArtists()
      } else {
        this.loadAlbumsForArtist(state["artist"], state["artistName"])
      }
      return
    }

    if ("album" in state) {
      this.historyBack = true
      this.loadSongs(state["album"])
      return
    }

    if ("playlist" in state) {
      this.historyBack = true
      this.loadPlaylist()
      return
    }

    if ("files" in state) {
      this.historyBack = true
      this.loadFiles("", state['files'])
      return
    }

  }
}

document.addEventListener('DOMContentLoaded', () => {
  const musicPlayer = new MusicPLayer();
  musicPlayer.init();
  musicPlayer.loadArtists();
});