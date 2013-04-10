Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};

window.Playlist = (function(){
	var playlist = {},db,io, events=["startSong", "paused","playing","reset","deleted","added","moved","empty"], eventHandlers = {};
	playlist.init = function(cb){
		Squeeze.getPlaylist(function(data){
			playlist.items = Library.resolvePaths(JSON.parse(data));
			var i=0;
			cb(playlist.items)
		})
	};
	playlist.setCurrent = function(i){
		Squeeze.status.playlistIndex = i;
		var j=0;
		for (j; j<playlist.items.length; j++){
			playlist.items[j].playing = (i ===j);
		}
		playlist.startSong(playlist.items[i]);
	};
	events.map(function(m){
		eventHandlers[m] = [];
		playlist[m] = function(a,b,c,d,e){
			if (typeof a === "function"){
				eventHandlers[m].push(a);
			}
			else{
				eventHandlers[m].map(function(f){
					f(a,b,c,d,e);
				});
			}
		};
	});
	var deleteTrackAt = function(i){
		var p = playlist.items.splice(i,1);
		playlist.deleted(p);
		return p;
	};
	var addTrackAt = function(p,i){
		console.log("addTrackAt", p,i);
		playlist.items.splice(i,0,p);
		playlist.added(p,i);
	};
	playlist.handleEvent = function(r){
		switch (r[1]){
			case "pause":
				Squeeze.status.playing = r[2] === "0";
				if (r[2] === "1"){
					playlist.paused();
				}
				else{
					playlist.playing();
				}
				break;
			case "jump":
				var t = parseInt(r[2],10) || 0;
				playlist.setCurrent(t);
				break;
			case "delete":
					deleteTrackAt(parseInt(r[2]),10);
					break;
			case "move":
					var from = parseInt(r[2],10);
					var to = parseInt(r[3],10);
					playlist.items.move(from,to);
					Playlist.moved(from,to);
				break;	
			case "add":
				url = "file://" + decodeURIComponent(r[2]).replace(/\s/g,"%20");
				var l  = Library.resolvePaths([url]);
				if (l[0] === url){
					Squeeze.getPlaylist(function(data){
						data = Library.resolvePaths(JSON.parse(data));
						l = data[data.length -1];
						addTrackAt(l,playlist.items.length);
					});

				}
				else{
					addTrackAt(l[0],playlist.items.length);
				}
				break;
			case "loadtracks":
				Playlist.items = [];
				Playlist.empty();
			case "addtracks":
					if (r[2] === "listRef"){
						var index = parseInt(decodeURIComponent(r[r[1]=="addtracks" ?4:6]).split(":")[1],10);
						Squeeze.getPlaylist(function(data){
							data = Library.resolvePaths(JSON.parse(data));
							var next = playlist.items[index];
							data = data.slice(index, Math.infinity);
							var i=0;
							for (i; i<data.length; i++){
								addTrackAt(data[i],index+i);
							}
						});
					}
					else if (r[2].indexOf("track.id") > -1){
						var s= decodeURIComponent(r[2]);
						s = s.split(s.indexOf("=") >-1 ? "=":":")[1];
						var l = Library.getTrack(parseInt(s,10));
						var index = playlist.items.length+1;
						r.map(function(s){
							if (s.indexOf("index") > -1){
								index = parseInt(decodeURIComponent(s).split(":")[1],10)+1;
							}				
						});
						addTrackAt(l,index);
					}
					break;
			case "load_done":
				playlist.init(playlist.reset);
				break;

		}
	};

	return playlist;
}());