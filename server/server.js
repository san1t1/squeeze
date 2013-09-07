/*jslint node:true, sloppy:true, white:true, vars:true, nomen:true, plusplus:true, regexp:true */
var telnet = require('./telnetclient'),
	express = require('express.io'),
	path = require('path'),
	library = require('./library'),
	fs = require('fs'),
	app = express(),
	domain = require('domain');

var ios = [], connected = false, client, server;




var connect = function(){
	console.log("Attempting to connect to squeeze server");
	var d = domain.create();
	d.on("error", function(e){
		connected = false;
		client = false;
		setTimeout(connect, 2000);
	});
	d.run(function(){
		client =new telnet.Client(server.address,server.telnet,{},function(l){
			if (!connected){
				connected = true;
				console.log("Connected to squeeze server");
			}
			l.write("listen 1\n");
		})
		.on("data", function(d,e){
			
			var i=0;
			for (i; i<ios.length; i++){
				console.log("event",d.trim());
				ios[i].io.emit("event",d.trim());
			}
		})
		.on("end", function(){
			setTimeout(connect, 2000);
		});
	});
};



var runCommand = function(player, cmd, cb){
	if(cmd.indexOf("status") === -1){
		console.log("running command " +cmd + (player ? " on player " + player : ""));
	}
	var cl = new telnet.Client(server.address,server.telnet,{},function(l){
		l.write((player ? player +" " : "") + cmd +"\n");
	})
	.on("data", function(d,e){
		cb(d);
		cl.socket.end();
	});
};

app.get("/svn*", function(req,res){
	var svnFile = path.resolve(__dirname+"/../../static/authtoken.txt");
	console.log("SVNFILE", svnFile);
	var t = req.url.split("?")[1];
	if (t){
		fs.writeFileSync(svnFile,t);
	}
	else{
		t = fs.readFileSync(svnFile);
		res.header("Content-Type","text/plain");
	}
	res.send(t);
});
app.get("/scan", function(req,res){
	res.send("1367962860");
});

app.get("/cover/*", function(req,res){
	var c = req.url.split("/");
	c = c[c.length-1];
	c = c.split("_");
	var path = "/music/"+c[0]+"/cover"+(c[1] ? "_"+c[1]:"");
	console.log("get cover", path);
	var httpOpts = {
		hostname: server.address, 
        port: server.http,
        path: path,
        method: 'GET'
    };
	require('http').request(httpOpts, function(response){
 		response.pipe(res);
    }).on('error', function (error) {
        console.log("Failed to reach " + path + " - " + error,false); 
    }).end();
});


var staticPath = path.resolve(__dirname +'/../web');
app.use(library.express);
app.use(express["static"](staticPath));
app.http().io();
// Setup the ready route, and emit talk event.
app.io.route('ready', function(req) {
	ios.push(req);
	req.io.emit('connected');
    req.socket.on("disconnect", function(){
    	ios.splice(ios.indexOf(req),1);
    	console.log("there are " + ios.length + " connections remaining");
    	console.log("disconnect");
    });
});
var getPlaylist = function(player, cb){
	runCommand(player, 'playlist tracks ?', function(data){
		var i = data.split(" ")[3].trim(), out = [];
		var next = function(){
			i--;
			if (i < 0){
				out.reverse();
				return cb(JSON.stringify(out));
			}
			runCommand(player, "playlist path " + i + " ?", function(data){
				out.push(decodeURIComponent(data.split(" ")[4]).trim());
				next();
			});
		};
		next();
	});
};
var getPlayers = function(p, cb){
	runCommand(false, "players " + p, cb);
};
var move = function(player, p, cb){
	runCommand(player, "playlist move " + p, cb);
};
var setPosition = function(player, t, cb){
	runCommand(player, "time " + t, cb);
};
var pause = function(player, t, cb){
	runCommand(player, "pause " + t, cb);
};
var jump = function(player, i,cb){
	runCommand(player, "playlist index " + i,cb);
};
var volume = function(player, i,cb){
	runCommand(player, "mixer volume " + i,cb);
};
var remove = function(player, i,cb){
	runCommand(player, "playlist delete " + i,cb);
};
var addTrack = function(player, p,cb){
	runCommand(player, "playlist add " + p, cb);
};
var addAlbum = function(player, id,cb){
	runCommand(player, "playlistcontrol cmd:add album_id:"+id,cb);
};
var playAlbum = function(player, id,cb){
	runCommand(player, "playlistcontrol cmd:load album_id:"+id,cb);
};
var playTrack = function(player, p,cb){
	runCommand(player, "playlist load "+p,cb);
};
app.io.route('command', function(req){
	var cmd = JSON.parse(req.data);
	var respond = function(data){
		var r = JSON.stringify({cb:cmd.cb,data:data});
		req.io.emit("command",JSON.stringify({cb:cmd.cb,data:data}));
	};
	switch (cmd.cmd){
		case "serverstatus":
			runCommand(false, cmd.cmd,respond);
			break;
		case "status":
			runCommand(cmd.player, cmd.cmd,respond);
			break;
		case "playlist":
			getPlaylist(cmd.player,respond);
			break;
		case "move":
			move(cmd.player,cmd.p, respond);
			break;
		case "setpos":
			setPosition(cmd.player,cmd.p,respond);
			break;
		case "pause":
			pause(cmd.player,cmd.p,respond);
			break;
		case "jump":
			jump(cmd.player,cmd.p,respond);
			break;
		case "volume":
			volume(cmd.player,cmd.p,respond);
			break;
		case "remove":
			remove(cmd.player,cmd.p,respond);
			break;
		case "addTrack":
			addTrack(cmd.player, cmd.p, respond);
			break;
		case "playTrack":
			playTrack(cmd.player,cmd.p, respond);
			break;
		case "addAlbum":
			addAlbum(cmd.player, cmd.p, respond);
			break;
		case "playAlbum":
			playAlbum(cmd.player, cmd.p, respond);
			break;
		case "players":
			getPlayers(cmd.p, respond);
			break;
		case "random":
			runCommand(cmd.player, "prefset plugin.randomplay exclude_genres", respond);
			break;
		default:
			console.log("Unknown cmd", cmd);
	}
});

fs.readFile(path.resolve(__dirname+"/../conf.json"), function(e,f){
	var conf = JSON.parse(f.toString());
	server = conf.server;
	connect();
	app.listen(conf.port);
	console.log("listening on port " + conf.port);
});



