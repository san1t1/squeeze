/*jslint node:true, sloppy:true, white:true, vars:true, nomen:true, plusplus:true, regexp:true */
var http = require('http'),
	path = require('path'),
	fs = require('fs');


var saveString = 'file=squeeze_QTYPE.dataquery.xml&text=' + encodeURIComponent('<?xml version="1.0" encoding="utf-8"?><databasequery><dataquery><name>squeeze_QTYPE</name><description>all_|TYPE|</description><query>select * from QTYPE limit QSTART,QEND</query></dataquery></databasequery>');
var getPage = function(type, start, size, cb) {
	console.log(type, start);
	var ss = saveString.replace(/QTYPE/g, type).replace(/QSTART/, start).replace(/QEND/, size);
	var httpOpts = {
		hostname: "127.0.0.1",
		port: 9000,
		path: "/plugins/DatabaseQuery/webadminmethods_saveitem.html",
		method: 'POST',
		headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		}
	};
	http.request(httpOpts, function(response) {
		response.on("data", function(ck) {});
		response.on("end", function() {
			httpOpts.path = "/plugins/DatabaseQuery/databasequery_executedataquery.binfile?type=squeeze_QTYPE&as=csv".replace(/QTYPE/, type);
			httpOpts.method = "GET";
			http.request(httpOpts, function(response) {
				var b = [];
				response.on("data", function(ck) {
					b.push(ck.toString());
				});
				response.on("end", function() {
					var arr = b.join("").split("\n");
					var out = [];
					arr.map(function(a) {
						if (a.length) {
							out.push(a);
						}
					});
					cb(out);
				});
			}).end();
		});

	}).on('error', function(error) {
		cb("Failed to reach " + path + " - " + error, false);
	}).end(ss);

};


var toNumber = function(v) {
	if (v !== undefined && v !== false) {
		try {
			return parseInt(v,10);
		} catch (e) {
			return v;
		}
	}
	return null;
};
var toTimestamp = function(v) {
	return v * 1000;
};
var toBool = function(v) {
	return v !== "0";
};


var albumItems = {
	id: {
		name: "id",
		parser: toNumber
	},
	title: "album",
	titlesearch: "search",
	compilation: {
		name: "compliation",
		parser: toBool
	},
	year: {
		name: "year",
		parser: toNumber
	},
	contributor: {
		name: "artist_id",
		parser: toNumber
	},
	artwork: "coverid"
}, artistItems = {
		id: {
			name: "id",
			parser: toNumber
		},
		name: 'artist',
		namesearch: 'search'
	}, trackItems = {
		id: {
			name: "id",
			parser: toNumber
		},
		timestamp: {
			name: "added_time",
			parser: toTimestamp
		},
		primary_artist: {
			name: "artist_id",
			parser: toNumber
		},
		album: {
			name: "album_id",
			parser: toNumber
		},
		bitrate: {
			name: "bitrate",
			parser: toNumber
		},
		coverid: "coverid",
		secs: {
			name: "duration",
			parser: toNumber
		},
		titlesearch: "search",
		title: "title",
		tracknum: {
			name: "tracknum",
			parser: toNumber
		},
		url: "url",
		year: {
			name: "year",
			parser: toNumber
		}
	}, genreItems = {
		id: {
			name: "genre_id",
			parser: toNumber
		},
		name: "genre"
	};
var csvParse = function(csv, parser) {
	var cols = {},p;
	var header = csv.shift().split(";");
	for (p in parser) {
		if (parser.hasOwnProperty(p)){
			var i = header.indexOf(p);
			if (i > -1) {
				cols[p] = i;
			}
		}
	}
	var out = [];
	csv.map(function(row) {
		row = row.split(";");
		var a = {},p;
		for (p in parser) {
			if (parser.hasOwnProperty(p)){
				if (parser[p].name) {
					a[parser[p].name] = parser[p].parser(row[cols[p]]);
				} else {
					a[parser[p]] = row[cols[p]];
				}
			}
		}
		out.push(a);
	});
	return out;
};

//note - because of memory restrictions it may not be possible to JSON Stringify a huge collection at once
//so we stream the JSON output.
var getCollection = function(t, cb) {
	var fn = path.resolve(__dirname + '/../library/' + t.fn);
	try {
		fs.unlinkSync(fn);
	} catch (e) {}
	var f = fs.openSync(fn, "w");
	fs.writeSync(f, "[\n");
	var i = 0;
	var next = function() {
		getPage(t.name, i, 2000, function(csv) {
			var arr = csvParse(csv, t.parser);
			if (i > 0 && arr.length > 0) {
				fs.writeSync(f, ",\n");
			}
			var s = [];
			arr.map(function(a) {
				s.push(JSON.stringify(a));
			});
			fs.writeSync(f, s.join(",\n"));

			if (arr.length < 2000) {
				fs.writeSync(f, "\n]");
				fs.closeSync(f);
				cb(i + arr.length);
			} else {
				i = i + 2000;
				next();
			}
		});
	};
	next();
};


var scan = function(cb) {
	var types = [{
		name: "genres",
		fn: "genres.json",
		parser: genreItems
	}, {
		name: "albums",
		fn: "albums.json",
		parser: albumItems
	}, {
		name: "contributors",
		fn: "artists.json",
		parser: artistItems
	}, {
		name: "tracks",
		fn: "titles.json",
		parser: trackItems
	}];
	var next = function() {
		var t = types.shift();
		if (t) {
			getCollection(t, function(length) {
				console.log(t.name, length);
				var fn = path.resolve(__dirname + '/../library/' + t.fn);
				next();
			});
		} else {
			console.log("Library updated");
			if (cb) {
				cb();
			}
		}
	};
	next();
};
//scan();

module.exports = (function() {
	var out = {};
	out.express = function(req, res, next) {
		var fn;
		console.log(req.url);
		switch (req.url) {
			case "/albums":
				fn = "albums.json";
				break;
			case "/artists":
				fn = "artists.json";
				break;
			case "/titles":
				fn = "titles.json";
				break;
			default:
				return next();
		}
		fs.createReadStream(path.resolve(__dirname + "/../library/" + fn)).pipe(res);
	};
	out.scan = scan;
	return out;
}());