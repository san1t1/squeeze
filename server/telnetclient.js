var
	sys = require('sys'),
	net = require('net'),
	events = require('events'),
	util = require('util'),
	socks = require('socks');

const __DEBUG__=false;
function log(){
	if (!__DEBUG__) return;
	for (var i=0;i<arguments.length;i++){
		util.print(arguments[i]);
	}
}
const
	IAC = 255,
	DONT = 254,
	DO = 253,
	WONT = 252,
	WILL = 251,
	SB = 250,
	GA = 249,
	EL = 248,
	EC = 247,
	SE = 240;

function Client(HOST, PORT, options,cb){
	var me = this, opts = {};
	this.socket = null;

	if (typeof options == 'object'){
		opts = options || opts;
	}
	if (typeof opts.connect == 'undefined') {
		opts.connect = true;
	}
	opts.host = HOST;
	opts.port = PORT;

	this.host = function(h){
		opts.host = h;
	}
	this.port = function(p){
		opts.port = p;
	}
	function afterconnect(socket){
		if (!socket) {
			console.log('ERROR: socket is null');
			return;
		}
		if (typeof opts.handler == 'undefined') {
			opts.handler = new parse(socket);
		} else	{
			opts.handler.socket = socket;
		}
		opts.handler.client = me;
		//process.stdin.resume();
		//process.stdin.pipe(socket);
		socket.on('data', function(data) {
			log(data);
			opts.handler.handleData(data,opts.callback);
		});
		socket.on('close', function() {
			process.stdin.destroy();
			//console.log('Connection closed');
			me.emit('end');
		});
		cb(socket);
	}
	this.connect = function(){
		if (typeof opts.proxy == 'object') {
			socks({
				host:opts.proxy.host,
				port:opts.proxy.port,
				username:opts.proxy.username,
				password:opts.proxy.password,
				targethost:HOST,
				targetport:PORT,
				callback:function(socket){
					console.log('proxy connect success');
					afterconnect(socket);
				}
			});
		} else {
			me.socket = new net.Socket();
			me.socket.connect(opts.port, opts.host, function() {
				me.socket.setKeepAlive(false);
				afterconnect(me.socket);
			});
		}
	}
	if (opts.connect) {
		me.connect();
	}
}
sys.inherits(Client,events.EventEmitter);
function parse(socket){
	var me = this;
	this.socket = socket;
	this.handleData = function(data,callback){
		//console.log(data);
		var arr=[],arr2,sb=false;
		for (var i=0;i<data.length;i++){
			if (sb){
				arr2.push(data[i]);
				if (data[i+1]==IAC && data[i+2]==SE) sb = false;
			} else {
				switch(data[i]){
					case IAC:
						switch(data[++i]){
							case DONT:
								me.handle_IAC_DONT(data[++i]);
								break;
							case DO:
								me.handle_IAC_DO(data[++i]);
								break;
							case WONT:
								me.handle_IAC_WONT(data[++i]);
								break;
							case WILL:
								me.handle_IAC_WILL(data[++i]);
								break;
							case SB:
								arr2=[];
								sb = true;
								break;
							case SE:
								me.handle_IAC_SubItem(new Buffer(arr2));
								sb = false;
								break;
							default:
								util.print(data[i++]);
						}
						break;
					default:
						if (data[i]==0) i=data.length;
						else arr.push(data[i]);
				}
			}
		}
		if (arr.length != 0) {
			var s = new Buffer(arr).toString();
			//arr[arr.length-1] != 0x0a && 
			if (typeof me.client != 'undefined'){
				me.client.emit('data',s);
			}
		}
	}
	this.handle_IAC_DO = function(cmd){
		log('S>IAC DO '+cmd);
		switch(cmd){
			case 1:
				me.socket.write(new Buffer([IAC,WILL,1]));
				log('C>IAC WILL 1');
				break;
			case 24:
				me.socket.write(new Buffer([IAC,WILL,24]));
				log('C>IAC WILL 24');
				break;
			case 31:
				me.socket.write(new Buffer([IAC,WILL,31,IAC,SB,31,0,80,0,26,IAC,SE]));
				log('C>IAC WILL 31/80x26');
				break;
			case 35:
			case 36:
				me.socket.write(new Buffer([IAC,WONT,cmd]));
				log('C>IAC WONT '+cmd);
				break;
			case 39:
				me.socket.write(new Buffer([IAC,WILL,39]));
				log('C>IAC WILL 39');
				break;
			default:
				me.socket.write(new Buffer([IAC,WONT,cmd]));
				log('C>IAC WONT '+cmd);
		}
	}
	this.handle_IAC_WILL = function(cmd){
		log('S>IAC WILL ' + cmd);
		me.socket.write(new Buffer([IAC,DO,cmd]));
		log('C>IAC DO '+cmd);
	}
	this.handle_IAC_DONT = function(cmd){
		log('S>IAC DONT '+cmd);
		switch(cmd){
			case 1:
				me.socket.write(new Buffer([IAC,WONT,1]));
				break;
			case 35:
			case 36:
				me.socket.write(new Buffer([IAC,WONT,cmd]));
				break;
		}
	}
	this.handle_IAC_WONT = function(cmd){
		log('S>IAC WONT '+cmd);
		
	}
	this.handle_IAC_SubItem = function(item){
		log('S>IAC SubItem '+item);
		switch(item[0]){
			case 24:
				var buf = new Buffer(11);
				new Buffer([IAC,SB,24,0]).copy(buf,0);
				new Buffer('VT100').copy(buf,4);
				new Buffer([IAC,SE]).copy(buf,9);
				me.socket.write(buf);
				break;
			case 39:
				me.socket.write(new Buffer([IAC,SB,39,0,IAC,SE]));
				break;
		}
	}
}
module.exports = {
	Client: Client,
	parse: parse
}