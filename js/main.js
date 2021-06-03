var google_token;

Date.prototype.yyyymmdd = function() {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return [this.getFullYear(),
          (mm>9 ? '' : '0') + mm,
          (dd>9 ? '' : '0') + dd
        ].join('/');
};

if (localStorage.getItem('google_token')) {
  google_token = localStorage.getItem('google_token');
  document.querySelector('#google-auth').style.display = 'none';
  if (localStorage.getItem('google_album_id')) {
    getAlbumPhoto(localStorage.getItem('google_album_id'));
  } else {
    getAlbums();
  }
}

document.querySelector('#google-auth').onclick = function(event) {
  getGoogleToken();
};

function getGoogleToken() {
  chrome.identity.getAuthToken({interactive: true}, function(token) {
    if (chrome.runtime.lastError) {
      alert(chrome.runtime.lastError.message);
      return;
    }
    google_token = token;
    localStorage.setItem('google_token', google_token);
    getAlbums();
    document.querySelector('#google-auth').style.display = 'none';
  });
}

function removeGoogle() {
  chrome.identity.clearAllCachedAuthTokens(function(){
    localStorage.removeItem('google_token');
    localStorage.removeItem('google_album_id');
  });
}

function getAlbums(page_token = false) {
  document.querySelector('.loader').style.display = 'block';
  var x = new XMLHttpRequest();
  if (page_token) {
    x.open('GET', 'https://photoslibrary.googleapis.com/v1/albums?pageToken=' + page_token);
  } else {
    x.open('GET', 'https://photoslibrary.googleapis.com/v1/albums');
  }
  x.setRequestHeader('Authorization', 'Bearer ' + google_token);

  x.onload = function() {
    var response = JSON.parse(x.response);
    var good_ones_album;
    response.albums.forEach((album) => {
      if (album.title == 'GoodOnes' && !good_ones_album) {
        good_ones_album = album;
        localStorage.setItem('google_album_id', album.id);
        getAlbumPhoto(album.id);
      }
    });
    if (!good_ones_album && response.nextPageToken) {
      getAlbums(response.nextPageToken);
    }
  };
  x.send();
}

function getAlbumPhoto(album_id, page_token = false) {
  if (localStorage.getItem('google_last_photo_url')) {
    document.querySelector('.loader').style.display = 'none';
    document.querySelector('.photo-date').innerHTML = localStorage.getItem('google_last_photo_data');
    document.querySelector('#google-photos-container').style.backgroundImage = "url('" + localStorage.getItem('google_last_photo_url') +"')";
    document.querySelector('body').style.backgroundImage = "url('" + localStorage.getItem('google_last_photo_url') +"')";
  }
  var x = new XMLHttpRequest();

  var params = JSON.stringify({
    "albumId": album_id,
    "pageSize": "50"
  });

  if (page_token) {
    params = JSON.stringify({
      "albumId": album_id,
      "pageSize": "50",
      "pageToken": page_token
    });
  }
  x.open('POST', 'https://photoslibrary.googleapis.com/v1/mediaItems:search');
  x.setRequestHeader('Authorization', 'Bearer ' + google_token);

  x.onload = function() {
    var response = JSON.parse(x.response);
    if (response.error) {
      getGoogleToken();
    } else {
      var images = response.mediaItems;
      if (response.nextPageToken && Math.random() < 0.5 && localStorage.getItem('google_last_photo_url')) {
        getAlbumPhoto(album_id, response.nextPageToken);
        return;
      }
      getRandomImage(response);
    }
  }
  x.send(params);
}

function getRandomImage(response) {
  var mediaItems = response.mediaItems;
  var image = mediaItems[Math.floor(Math.random() * mediaItems.length)];
  if (!image.mimeType.includes('image')) {
    image = null;
    mediaItems.forEach((media) => {
      if (media.mimeType.includes('image')) {
        image = media;
      }
    });
  }
  console.log(image)
  if (image) {
    var date = new Date(image.mediaMetadata.creationTime);
    localStorage.setItem('google_last_photo_data', date.yyyymmdd());
    if (!localStorage.getItem('google_last_photo_url')) {
      document.querySelector('.loader').style.display = 'none';
      document.querySelector('#google-photos-container').style.backgroundImage = 'url(' + image.baseUrl +'=w2048-h1024)';
      document.querySelector('body').style.backgroundImage = "url('" + image.baseUrl +"')";
      document.querySelector('.photo-date').innerHTML = localStorage.getItem('google_last_photo_data');
    }
    localStorage.setItem('google_last_photo_url', image.baseUrl + '=w2048-h1024');
    console.log(image.productUrl)
  } else {
    getAlbumPhoto(localStorage.getItem('google_album_id'), response.nextPageToken);
  }
}
