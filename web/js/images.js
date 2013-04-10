
(function(){
	window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
	var fs, imgCache = {};
	function toArray(list) {return Array.prototype.slice.call(list || [], 0);};
	window.webkitStorageInfo.requestQuota(PERSISTENT, 52428800 * 4, function (grantedBytes) {
		window.requestFileSystem(window.PERSISTENT, 52428800 * 4, function (r) {
			fs = r;
		}, function (err) {
			console.log(err);
		});
	}, function (e) {console.log('Error getting quota', e);
	});
	var queue = [];
	var saveImage = function (cover, data) {
		queue.push({cover:cover,data:data});
		var next = function(){
			var q = queue.shift();
			if (!q){return;}
			fs.root.getFile(q.cover, {create: true}, function (fileEntry) {
				// Create a FileWriter object for our FileEntry (log.txt).
				fileEntry.createWriter(function (fileWriter) {
					fileWriter.write(new Blob([q.data], {type: 'text/plain'}));
					fileWriter.onwriteend = next;
				});
			});
		};
		if (queue.length === 1){next();	}
	};

	window.fetchCover = function (target, cover, cb) {
		cb = cb || noOp;
		//if (imgCache[cover]) { target.attr("src", imgCache[cover]); return cb();};
		fs.root.getFile(cover, {}, function (fileEntry) {
			fileEntry.file(function (file) {
				var reader = new FileReader();
				reader.onloadend = function (e) {
					target.attr("src", this.result);
					setTimeout(cb,0);
				};
				reader.readAsText(file);
			});
		}, function (e) {
			var img = document.createElement("img");
			img.onload = function () {
				var canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				var ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0);
				var dataURL = canvas.toDataURL("image/png");
				target.attr("src", dataURL);
				saveImage(cover, dataURL);
				//imgCache[cover] = dataURL;
				img = null;
				setTimeout(cb,0);
			};
			img.src = "/cover/" + cover;
		});
	};
}());