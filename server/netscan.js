
var evilscan = require('evilscan'), os=require('os'), dns = require('dns');

var scan = function(ip, cb){
	var options = {
	    target:ip.replace(/\d\d?\d?$/,"0/24"),
	    port:'9000,9090',
	    status:'O', // Timeout, Refused, Open, Unreachable
	    banner:false
	};
	var server = false;

	var scanner = new evilscan(options, function(sc){});

	scanner.on('result',function(data) {
	        if (!server){
	        	server = data.ip;
	        }
	        else if (server !== data.ip){
	        	data.ip = false;
	        }
	});

	scanner.on('error',function(err) {
	        throw new Error(data.toString());
	});

	scanner.on('done',function() {
	        cb (server);
	});
	scanner.run();
};

var ifaces=os.networkInterfaces();
for (var dev in ifaces) {
  var alias=0;
  ifaces[dev].forEach(function(details){
    if (details.family=='IPv4' && details.address !=="127.0.0.1") {
      
      scan(details.address, function(server){
      		if (server = details.address){
      			console.log("SERVER IS LOCAL");
      		}
      		else{
      			dns.reverse(server,function(e,r){
      				console.log("SERVER IS " + r);
      			});
      		}
      		
      });
    }
  });
}

