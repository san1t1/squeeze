(function() {
	var queue = [];
	var next = function() {
		var q = queue.shift();
		if (!q) {
			return;
		}
		window.Squeeze.fs.root.getFile(q.cover, {
			create: true
		}, function(fileEntry) {
			// Create a FileWriter object for our FileEntry (log.txt).
			fileEntry.createWriter(function(fileWriter) {
				fileWriter.write(new Blob([q.data], {
					type: 'text/plain'
				}));
				fileWriter.onwriteend = next;
			});
		});
	};
	window.saveImage = function(cover, data) {
		queue.push({
			cover: cover,
			data: data
		});
		if (queue.length === 1) {
			next();
		}
	};
}());
(function() {
	var queue = [];
	var next = function() {
		if (queue.length === 0) {
			return;
		}
		var q = queue.shift();
		var img = document.createElement("img");
		img.onload = function() {
			var canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			var ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);
			var dataURL = canvas.toDataURL("image/png");
			q.target.attr("src", dataURL);
			window.saveImage(q.cover, dataURL);
			//imgCache[cover] = dataURL;
			img = null;
			q.cb();
			var newQueue = [];
			queue.map(function(l) {
				if (l.cover === q.cover) {
					l.target.attr("src", dataURL);
					l.cb();
				} else {
					newQueue.push(l);
				}
				queue = newQueue;
			});
			next();
		};
		img.src = "/cover/" + q.cover;
	};
	window.fetchCover = function(target, cover, cb, promote) {
		cb = cb || noOp;
		if (!cover || /^_/.test(cover)) {
			return cb();
		}
		window.Squeeze.fs.root.getFile(cover, {}, function(fileEntry) {
			fileEntry.file(function(file) {
				var reader = new FileReader();
				reader.onloadend = function(e) {
					target.attr("src", this.result);
					cb();
				};
				reader.readAsText(file);
			});
		}, function(e) {
			var o = {
				target: target,
				cover: cover,
				cb: cb
			};
			if (promote) {
				queue.unshift(o);
			} else {
				queue.push(o);
			}
			if (queue.length === 1) {
				setTimeout(next, 0);
			}
		});
	};
	window.fetchCover.stop = function() {
		queue = [];
	}
}());