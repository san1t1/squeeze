window.Squeeze = (function(){
	var sq = {status:{},playing:{}};
	var io = window.io.connect(), connected = false;
	var q =[], handlers={},busy=false, events=["connected"], eventHandlers={};

	io.on("command",function(r){
		r = JSON.parse(r);
		var h = handlers[r.cb];
		try{
			if (!h.persist){
				delete handlers[r.cb];
			}
		}catch(e){
			console.log("ERROR",e,h);
		}
		h.cb(r.data);
	}).on("disconnect", function(r){
		console.log("disconnected. shit");

	}).on("reconnect", function(){
		console.log("hi again!");
		io.emit('ready');
	});
	io.on("event", function(r){
		console.log("event", r);
		r = r.split(" ");
		r.shift();
		switch (r[0]){
			case "prefset":
				if (r[2] === "currentSong"){
					Playlist.setCurrent(parseInt(r[3],10));
				}
				break;
			case "playlist":
				Playlist.handleEvent(r);
				break;
		}
	});

	var runQueue = function(){
		if (busy){return;}
		var c = q.shift();
		if (!c){
			return;
		}
		busy = true;
		var d = Date.now();
		var cmd = JSON.stringify({cmd:c.cmd,p:c.parm,cb:d});
		handlers[d] = c;
		setTimeout(function(){
			//console.log("emmitting", cmd);
			io.emit("command",cmd);
			busy = false;
			runQueue();
		},c.delay)
	};
	var statusParser = function(data){
		data = data.split(" ");
		data.splice(3).map(function(d){
			var d = decodeURIComponent(d).trim().split(":");
			switch(d[0]){
				case "duration": sq.playing.duration = parseInt(d[1],10); break;
				case "mixer volume": sq.status.volume = parseInt(d[1],10); break;
				case "mode":sq.status.playing = d[1]==="play"; break;
				case "player_name": sq.status.player = d[1]; break;
				case "playlist repeat": sq.status.repeat = d[1] === "1";break;
				case "playlist shuffle": sq.status.shuffle = d[1] === "1";break;
				case "playlist_cur_index": sq.status.playlistIndex = parseInt(d[1],10); break;
				case "playlist_tracks": sq.status.playlistLength = parseInt(d[1],10); break;
				case "signalstrength":sq.status.playerSignal = d[1]/100; break;
				case "time": sq.playing.position = parseInt(d[1]); break;
				
			}
		});
	};
	var queue = function(cmd, parm, cb, delay, persist){
		var d = Date.now();
		q.push({cmd:cmd,parm:parm,cb:cb,delay:delay || 0, persist:persist});
		runQueue();
	};

	events.map(function(m){
		eventHandlers[m] = [];
		sq[m] = function(a,b,c,d,e){
			if (typeof a === "function"){
				eventHandlers[m].push(a);
			}
			else{
				console.log("event",m);
				eventHandlers[m].map(function(f){
					console.log(f);
					f(a);
				});
			}
		};
	});
	sq.connect = function(cb){
		io.emit('ready');
		var ssr = false, sr = false;
		queue("serverstatus", false,function(data){
			ssr = true;
			data = data.split(" ");
			var out={};
			data.splice(3).map(function(d){
				var d = decodeURIComponent(d).trim().split(":");
				switch(d[0]){
					case "info total albums":
						out.albums = parseInt(d[1],10);
						break;
					case "info total artists":
						out.artists = parseInt(d[1],10);
						break;
					case "info total songs":
						out.titles = parseInt(d[1],10);
						break;
					case "player count":
						out.players = parseInt(d[1],10);
						break;
					case "info total genres":
					case "sn player count":
					case "uuid":
					case "other player count":
						break;
					default:
						out[d[0]] = d[1];
				}
			});
			sq.serverStatus = out;
			if (!connected && sr){
				sq.connected();
				connected = true;
				cb(sq.serverStatus, sq.status);	
			}
		},0,true);
		queue("status", false, function(data){
			sr = true;
			statusParser(data);
			if (!connected && ssr){
				sq.connected();
				connected = true;
				cb(sq.serverStatus, sq.status);	
			}
		});
	};
	sq.getStore = function(store, p, cb){
		queue(store, p, cb);
	};
	sq.getPlaylist = function(cb){
		queue("playlist", false, cb);
	};
	sq.getStatus = function(cb){
		queue("status", false, function(data){
			statusParser(data);
			cb();
		});
	};
	sq.move = function(from, to){
		if (from === to){return;}
		queue("move", from+" " + to,noOp);
	};
	sq.setPosition = function(t){
		queue("setpos", t, noOp);
	};
	sq.pause = function(){
		queue("pause", "1", noOp);
	};
	sq.play = function(){
		queue("pause", "0", noOp);
	};
	sq.jumpTo = function(i){
		queue("jump",i,noOp);
	};
	sq.volume = function(i){
		queue("volume",i,noOp);
	};
	sq.remove = function(i){
		queue("remove", i, noOp);
	};
	sq.addTrack = function(track,cb){
		queue("addTrack", track, cb || noOp);
	};
	sq.addTrackAt = function(track, index){
		queue("addTrackAt", track +" "+index, noOp);
	};
	sq.playTrack = function(track){
		queue("playTrack", track,noOp)
	};
	sq.addAlbum = function(album){
		queue("addAlbum", album,noOp)
	};
	sq.playAlbum = function(album){
		queue("playAlbum", album,noOp)
	};
	return sq;
}());



