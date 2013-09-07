/*jslint sloppy:true, browser:true,  white:true, vars:true, plusplus:true*/ 
/*globals FileReader, $,Blob,Library , results:true*/
window.Library = (function() {
  var lib = {}, db, stores = ["artists", "albums", "titles"];
  var fs = window.Squeeze.fs;
  var lastScan;
  var searches = [];
  var objects = {};
  var recents = [];
  lib.getObjects = function() {
    return objects;
  };
  lib.init = function(cb) {

    var prepareRecents = function() {
      var handled = [];
      var i = 0;
      for (i; i < objects.titles.length; i++) {
        var t = objects.titles[i];
        if (handled.indexOf(t.album_id) === -1) {
          handled.push(t.album_id);
          var j = 0;
          for (j; j < objects.albums.length; j++) {
            if (objects.albums[j].id === t.album_id) {
              objects.albums[j].addedTime = new Date(t.added_time * 1000);
              break;
            }
          }

        }
      }
      objects.albums.sort(function(a, b) {
        return a.addedTime > b.addedTime ? -1 : 1;
      });
      recents = objects.albums.slice(0, 400);
    };


    var onScanCheck = function() {
      var i = 0;
      stores.map(function(store) {
        var idx = store.substr(0, store.length - 1);
        searches.push(function(q) {
          var r = [];
          try {
            q.map(function(t) {
              r.push(new RegExp(t));
            });
          } catch (e) {
            return;
          }
          var out = [],
            i = 0;
          for (i; i < objects[store].length; i++) {
            if (objects[store][i].search) {
              var add = true,
                x = objects[store][i].search.toLowerCase(),
                j = 0;
              for (j; j < r.length; j++) {
                add = r[j].test(x);
                if (!add) {
                  break;
                }
              }
              if (add) {
                out.push(objects[store][i]);
              }
            }
          }
          return {
            name: store,
            results: out
          };
        });

        window.Squeeze.fs.root.getFile(store + ".json", {}, function(fileEntry) {
          fileEntry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = function(e) {
              objects[store] = JSON.parse(this.result);
              i++;
              console.log(store, objects[store].length, i);

              if (i === stores.length) {
                prepareRecents();
                console.log(objects);
                cb();
              }
            };
            reader.readAsText(file);
          });
        }, function(e) {
          $.get("/" + store, function(r) {
            objects[store] = JSON.parse(r);
            /*r = r.replace(/\}\{/g, "}\n{");
            r.split("\n").map(function (a) {
              try {
                objects[store].push(JSON.parse(a));
              } catch (e) {
                console.log(e, a);
              }
            });*/
            window.Squeeze.fs.root.getFile(store + ".json", {
              create: true
            }, function(fileEntry) {
              fileEntry.createWriter(function(fileWriter) {
                fileWriter.write(new Blob([JSON.stringify(objects[store])]), {
                  type: 'text/plain'
                });
                fileWriter.onwriteend = function() {
                  i++;
                  if (i === stores.length) {
                    localStorage.lastScan = lastScan;
                    prepareRecents();
                    cb();
                  }
                };
              });
            }, function(e) {
              console.log(e);
            });
          });
        });
      });

    };
    $.get("/scan", function(r) {
      lastScan = r;
      console.log("scan", r, localStorage.lastScan);
      if (lastScan !== localStorage.lastScan) {
        //clearCache();
        setTimeout(onScanCheck, 5000);
      } else {
        onScanCheck();
      }
    });

  };


  lib.search = function(q) {
    q = q.toLowerCase().split(" ");
    var i = 0,
      out = {};
    for (i; i < searches.length; i++) {
      var x = searches[i](q);
      out[x.name] = x.results;
    }
    return out;
  };
  lib.resolvePaths = function(items) {
    var i = 0,
      r = 0;
    for (i; i < objects.titles.length; i++) {
      var x = items.indexOf(objects.titles[i].url);
      if (x > -1) {
        items[x] = objects.titles[i];
        r++;
        if (r === items.length) {
          break;
        }
      }
    }
    //check for dups
    i = 0;
    for (i; i < items.length; i++) {
      if (!items[i].url) {
        var j = 0;
        for (j; j < items.length; j++) {
          if (items[j].url === items[i]) {
            items[i] = items[j];
            break;
          }
        }
      }
    }

    return items;
  };
  var getById = function(s, key, single) {
    var sC = {}, mC = {};
    return function(id) {
      if (!id) {
        return single ? {
          artist: ""
        } : [{
          artist: ""
        }];
      }
      var c = (single ? sC : mC)[id];
      if (c) {
        return c;
      }
      var i = 0,
        out = [];
      for (i; i < objects[s].length; i++) {
        if (objects[s][i][key] - id === 0) {
          if (single) {
            var x = objects[s][i];
            sC[id] = x;
            return x;
          }
          out.push(objects[s][i]);
        }
      }
      mC[id] = out;
      return out;
    };
  };
  lib.getArtist = getById("artists", "id", true);
  lib.getAlbum = getById("albums", "id", true);
  lib.getAlbums = getById("albums", "artist_id");
  lib.getTrack = getById("titles", "id", true);
  lib.getTracks = getById("titles", "album_id");

  lib.getRecentAlbums = function(i) {
    if (recents) {
      if (results) {
        results.albums = recents;
        results.titles = [];
        results.artists = [];
      } else {
        results = {
          albums: recents,
          titles: []
        };
      }
      return;
    }
    i = i || 200;
    var tracks = objects.titles.slice(0);
    var out = [];
    tracks.sort(function(a, b) {
      return a.id && (a.id > b.id) ? -1 : 1;
    });
    while (out.length < i) {
      var t = tracks.shift();
      if (out.indexOf(t.album_id) === -1) {
        out.push(t.album_id);
      }
    }
    i = 0;
    for (i; i < out.length; i++) {
      out[i] = lib.getAlbum(out[i]);
    }
    out.sort(function(a, b) {
      a = Library.getTracks(a.id)[0] || {
        addedTime: 0
      };
      b = Library.getTracks(b.id)[0] || {
        addedTime: 0
      };
      return a.addedTime > b.addedTime ? -1 : 1;
    });
    recents = {
      albums: out,
      titles: [],
      artists: []
    };
    results = recents;
    window.Squeeze.fs.root.getFile("recents.json", {
      create: true
    }, function(fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.write(new Blob([JSON.stringify(recents)]), {
          type: 'text/plain'
        });
      });
    }, function(e) {
      console.log(e);
    });
  };
 return lib;
}());