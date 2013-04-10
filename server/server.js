var telnet = require('./telnetclient'),
	express = require('express.io'),
	fs = require('fs'),
	app = express();

var ios = [];

var client =new telnet.Client("127.0.0.1",9090,{},function(l){
		l.write("listen 1\n");
	})
	.on("data", function(d,e){
		var i=0;
		for (i; i<ios.length; i++){
			console.log("event",d.trim());
			ios[i].io.emit("event",d.trim());
		}
	})
	.on("end", function(){console.log("server dicsonnceted");})

var runCommand = function(cmd, cb){
	if(cmd.indexOf("status") === -1){
		console.log("running command '" +cmd +"'");
	}
	var cl = new telnet.Client("127.0.0.1",9090,{},function(l){
		l.write(cmd +"\n");
	})
	.on("data", function(d,e){
		cb(d);
		cl.socket.end();
	})
};

app.get("/svn*", function(req,res){
	var t = req.url.split("?")[1];
	if (t){
		fs.writeFileSync("/home/tim/authtoken.txt",t);
	}
	else{
		t = fs.readFileSync("")
	}
	res.send("thanks", t);
});

app.get("/cover/*", function(req,res){
	var c = req.url.split("/");
	c = c[c.length-1];
	c = c.split("_");
	var path = "/music/"+c[0]+"/cover"+(c[1] ? "_"+c[1]:"");
	console.log("get cover", path);
	var httpOpts = {
		hostname: "127.0.0.1", 
        port: 9000,
        path: path,
        method: 'GET'
    };
	require('http').request(httpOpts, function(response){
 		response.pipe(res);
    }).on('error', function (error) {
        cb("Failed to reach " + path + " - " + error,false); 
    }).end();
});
app.use(express.static(__dirname + '/../web'));
app.http().io();
// Setup the ready route, and emit talk event.
app.io.route('ready', function(req) {
	ios.push(req);
	req.io.emit('connected');
    req.socket.on("disconnect", function(){
    	ios.splice(ios.indexOf(req),1);
    	console.log("there are " + ios.length + " connections remaining");
    	console.log("disconnect");
    })
});
var tagSet = {
	artists:"s",
	albums:"alwSj",
	titles:"DatudesydcC"
};
var getStore = function(c,p, cb){	
	var tags = tagSet[c];
	var cmd = c + " " + p+" tags:" + tags;
	runCommand(cmd, function(data){
		var d = data;
		data = data.split(" ");
		var i=0;
		for (i; i<data.length; i++){
			try{
				data[i] = decodeURIComponent(data[i]).trim();
			}
			catch (e){
				console.error(e, data[i]);
			}
		}
		data.shift();
		var obj={};
		var start = data.shift();
		obj.start =parseInt(start,10);
		obj.end=parseInt(data.shift(),10);
		data.shift();
		obj.items = [];
		var it = d = false;
		while (data.length > 1){
			d = data.shift().split(":");
			switch (d[0]){
				case "id":
					if (it){obj.items.push(it)};
					it = {id:parseInt(d[1],10)};
					break
				case "artist_id":
				case "album_id":
				case "duration":
				case "year":
				case "artwork_track_id":
				case "tracknum":
					it[d[0]] = parseInt(d[1],10);
					break;
				case "compilation":
					it.compilation = d[1] === "1";
					break;
					
				default:
					var x = d.shift();
					it[x] = d.join(":");
			}
		}
		obj.items.push(it);
		obj.total = parseInt(data.shift().split(":")[1],10);
		setTimeout(function(){ //use a delay to prevent locking sqlite too long.
			cb(JSON.stringify(obj));
		},250);
	});
};
var getPlaylist = function(cb){
	runCommand('playlist tracks ?', function(data){
		var i = data.split(" ")[3].trim(), out = [];
		var next = function(){
			i--;
			if (i < 0){
				out.reverse();
				return cb(JSON.stringify(out));
			}
			runCommand("playlist path " + i + " ?", function(data){
				out.push(decodeURIComponent(data.split(" ")[4]).trim());
				next();
			});
		};
		next();
	})
};
var move = function(p, cb){
	runCommand("playlist move " + p, cb);
};
var setPosition = function(t, cb){
	runCommand("time " + t, cb);
};
var pause = function(t, cb){
	runCommand("pause " + t, cb);
};
var jump = function(i,cb){
	runCommand("playlist index " + i,cb);
};
var volume = function(i,cb){
	runCommand("mixer volume " + i,cb);
};
var remove = function(i,cb){
	runCommand("playlist delete " + i,cb);
};
var addTrack = function(p,cb){
	runCommand("playlist add " + p, cb);
};
var addAlbum = function(id,cb){
	runCommand("playlistcontrol cmd:add album_id:"+id,cb);
};
var playAlbum = function(id,cb){
	runCommand("playlistcontrol cmd:load album_id:"+id,cb);
};
var playTrack = function(p,cb){
	runCommand("playlist load "+p,cb);
};
app.io.route('command', function(req){
	var cmd = JSON.parse(req.data);
	var respond = function(data){
		var r = JSON.stringify({cb:cmd.cb,data:data});
		req.io.emit("command",JSON.stringify({cb:cmd.cb,data:data}));
	};
	switch (cmd.cmd){
		case "serverstatus":
		case "status":
			runCommand(cmd.cmd,respond);
			break;
		case "artists":
		case "albums":
		case "titles":
			getStore(cmd.cmd, cmd.p,respond);
			break;
		case "playlist":
			getPlaylist(respond);
			break;
		case "move":
			move(cmd.p, respond);
			break;
		case "setpos":
			setPosition(cmd.p,respond);
			break;
		case "pause":
			pause(cmd.p,respond);
			break;
		case "jump":
			jump(cmd.p,respond);
			break;
		case "volume":
			volume(cmd.p,respond);
			break;
		case "remove":
			remove(cmd.p,respond);
			break;
		case "addTrack":
			addTrack(cmd.p, respond);
			break;
		case "playTrack":
			playTrack(cmd.p, respond);
			break;
		case "addAlbum":
			addAlbum(cmd.p, respond);
			break;
		case "playAlbum":
			playAlbum(cmd.p, respond);
			break;
		default:
			console.log("Unknown cmd", cmd);
	}
});
app.listen(8080);

