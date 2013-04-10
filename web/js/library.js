window.Library = (function () {
//  	var dbreq = window.indexedDB.deleteDatabase("squeeze");
  	var lib = {}, db, stores = ["artists", "albums", "titles"];
  	
  	var loadData = function (st, items, cb) {
  		if (items.length === 0) {
  			return cb();
  		}
  		var trans = db.transaction([st], "readwrite");
  		var store = trans.objectStore(st);
  		var it = items.shift();
  		//transform dates HERE
  		console.log(it.title || it.album || it.artist);
  		if (it.addedTime){
  			it.addedTime = it.addedTime * 1000;
  		}
  		var dbReq = store.put(it);
  		dbReq.onsuccess = function () {
  			loadData(st, items, cb);
  		};
  		dbReq.onerror = function (e) {
  			console.log(e.value);
  		};
  	};
  	var loadLibrary = function (cb) {
  		var searches = [];
  		var objects = {};
  		lib.search = function (q) {
  			q = q.toLowerCase().split(" ");
  			var i = 0,
  				out = {};
  			for (i; i < searches.length; i++) {
  				var x = searches[i](q);
  				out[x.name] = x.results;
  			}
  			return out;
  		};
  		lib.resolvePaths = function(items){
  			var i=0, r = 0;
  			for (i; i <objects.titles.length; i++){
	  			var x = items.indexOf(objects.titles[i].url);
	  			if (x > -1){
	  				items[x] = objects.titles[i];
	  				r ++;
	  				if (r ===items.length ){
	  					break;
	  				}
	  			}
	  		}
	  		//check for dups
	  		i = 0;
	  		for (i; i<items.length; i++){
	  			if (!items[i].url){
	  				var j = 0;
	  				for (j; j<items.length; j++){
	  					if (items[j].url === items[i]){
	  						items[i] = items[j];
	  						break;
	  					}
	  				}
	  			}
	  		}
	  		
	  		return items;
	  	};
  		var getById = function (s, key, single) {
  			return function (id) {
  				var i = 0,
  					out = [];
  				for (i; i < objects[s].length; i++) {
  					if (objects[s][i][key] === id) {
  						if (single) {
  							return objects[s][i];
  						}
  						out.push(objects[s][i]);
  					}
  				}
  				return out;
  			}
  		};
  		lib.getArtist = getById("artists", "id", true);
  		lib.getAlbum = getById("albums", "id", true);
  		lib.getAlbums = getById("albums", "artist_id");
  		lib.getTrack = getById("titles", "id", true);
  		lib.getTracks = getById("titles", "album_id");
  		lib.getRecentAlbums = function(i){
  			i = i || 200;
  			var tracks = objects["titles"].slice(0);
  			var out = [];
  			tracks.sort(function(a,b){
  				return a.addedTime && (a.addedTime> b.addedTime) ? -1 :1;
  			});
  			while (out.length <i){
  				var t = tracks.shift();
  				if (out.indexOf(t.album_id) === -1){
  					out.push(t.album_id);
  				}
  			}
  			i = 0;
  			for (i; i<out.length; i++){
  				out[i] = lib.getAlbum(out[i]);
  			}
        out.sort(function(a,b){
          return Library.getTracks(a.id)[0].addedTime > Library.getTracks(b.id)[0].addedTime ? -1 :1;
        });
  			results= {albums:out, titles:[], artists:[]};
  		};
  		var st = stores.slice(0);
  		(function next(s) {
  			if (s) {
  				objects[s] = [];
  				var idx = s.substr(0, s.length - 1);
  				var objectStore = db.transaction(s).objectStore(s);
  				objectStore.openCursor().onsuccess = function (event) {
  					var cursor = event.target.result;
  					if (cursor) {
  						objects[s].push(cursor.value);
  						cursor.
  						continue ();
  					} else {
  						searches.push(function (q) {
  							var r = [];
  							try{
	  							q.map(function(t){
	  								r.push( new RegExp(t));
	  							});
	  						}
	  						catch(e){return;}
  							var out = [],i = 0;
  							for (i; i < objects[s].length; i++) {
  								var add = true, x = objects[s][i][idx].toLowerCase(), j=0;
  								for (j; j<r.length; j++){
  									add = r[j].test(x);
  									if (!add){break;}
  								}
								if (add) {
									out.push(objects[s][i]);
								}
							}
  							return {
  								name: s,
  								results: out
  							};
  						});
  						console.log("database size",s, objects[s].length);
  						next(st.shift());
  					}
  				};
  			}
  			else{
  				cb();
  			}
  		}(st.shift()));
  	};
  	var getStore = function (store, cb) {
  		console.log("getting store", store);
  		var objectStore = db.transaction(store).objectStore(store);
  		objectStore.count().onsuccess = function (e) {
  			var next = function (start) {
  				Squeeze.getStore(store, start + " 50", function(data){
  					data = JSON.parse(data);
  					loadData(store, data.items, function () {
	  					if (data.start + 50 < data.total) {
	  						console.log(store, (Math.floor(((data.start + 50) / data.total) * 1000)) / 10 + "%");
	  						setTimeout(function () {
	  							next(data.start + 50);
	  						}, 1000);
	  					} else {
	  						cb();
	  					}
	  				});
  				});
  			};
  			next(Math.floor(e.target.result / 50) * 50);
  		};
  	};
  	lib.init = function (cb) {
  		console.log("library init");
  		var dbReq = indexedDB.open("squeeze", "1");
		
		dbReq.onupgradeneeded = function(e) {
			var d = e.target.result;
			console.log("opened db for upgrade");
		    stores.map(function(dbStore){
				if (d.objectStoreNames.contains(dbStore)){
		    		d.deleteObjectStore(dbStore)	    	
		    	}
		    	d.createObjectStore(dbStore,{keyPath: "id"});
			});
		};
		dbReq.onsuccess = function(e) {
			db = e.target.result;
			var st = stores.slice(0);
	  		var ls = function(){
	  			var s = st.shift();
	  			if (s){
	    			getStore(s, function(){
	    				ls();
	    			});
	    		}
	    		else{
	    			localStorage.lastGoodScan = Squeeze.serverStatus.lastscan;
	    			cb(true);
	    		}
	    	};
	    	
	    	if (localStorage.lastGoodScan === Squeeze.serverStatus.lastscan){
	    		console.log("library up to date");
	    	}
	    	else{

	    		ls();
	    	}
	    	loadLibrary(cb);
	    	
 		};
  	};
  	return lib;
}());

//1358087517