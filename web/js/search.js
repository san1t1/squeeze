var searchTimer = false,
	results;
var albumTrackTemplate = $(".albumTrack").detach();
var albumTemplate = $(".albumResult").detach();
var trackTemplate = $(".trackTrack").detach();
var albumResults = $(".albumResults");
var albumIndex = 0,
	lastSearch = "";
var colorCache = {};
Array.prototype.unique = function() {
	var o = {}, i, l = this.length,
		r = [];
	for (i = 0; i < l; i += 1) o[this[i]] = this[i];
	for (i in o) r.push(o[i]);
	return r;
};

var makeAlbumTrack = function(t, el, a) {
	var artist = Library.getArtist(t.artist_id).artist || t.artist;
	artist = a.compilation * 1 === 1 && artist ? " - " + artist : "";
	el.find(".albumTrackTitle").text(t.title + artist);
	el.find(".albumTrackPosition").text(t.tracknum || "");
	el.find(".albumTrackDuration").text(toMinSec(Math.floor(parseInt(t.duration, 10))));
	el.find(".albumTrackAddToEnd").click(function() {
		Squeeze.addTrack(t.url);
	});
	el.find(".albumTrackPlay").click(function() {
		Squeeze.playTrack(t.url, Playlist.items.length);
	});
	return el;
};
var albumSelector = function(t, a) {
	t.click(function() {
		if ($(".albumViewer").is(":visible")) {
			return;
		}
		var p = t.offset();
		var big = t.clone().css("position", "absolute").css("left", t[0].offsetLeft).css("top", t[0].offsetTop - $(".searchResults").scrollTop());;
		t.addClass("albumResultSelected");
		$(".search").append(big);
		big.css("visibility", "hidden");
		var hide = big.find(".albumResultAlbum, .albumResultArtistYear");
		hide.addClass("faded");
		var sr = $(".searchResults");
		var im = big.find("img");
		var tracklist = Library.getTracks(a.id);
		fetchCover(im, tracklist[0].coverid + "_500x500.png", function() {
			setTimeout(function() {
				big.css("visibility", "visible");
				big.addClass("albumViewer");
				var tracks = big.find(".albumTracks").hide().addClass("faded");

				tracklist.map(function(tk) {
					tracks.append(makeAlbumTrack(tk, albumTrackTemplate.clone(), a));
				});
				$(".albumResult").not(".albumViewer").addClass("mostlyFaded");
				big.find("div.albumResultCover").css({
					width: "30%",
					height: "auto"
				});
				big.css({
					left: "1%",
					top: "45px",
					width: "97%",
					height: "90%"
				});
				var colors = colorCache[tracklist[0].coverid] || getColors(im);
				colorCache[tracklist[0].coverid] = colors;
				var color = colors[1].join(',');
				colors = inverseColors(colors[1], colors[0]);
				var pr = colors[0].join(","),
					snd = colors[1].join(",");

				big.css('background', 'rgba(' + pr + ',0.6)');
				big.find('div.albumResultCover, div.albumResultBackground')
					.css('box-shadow', '-10px 10px 25px rgba(' + color + ',0.8)')
					.css("border", "1px solid rgb(" + snd + ")");
				big.find(".woodButton").css('box-shadow', '-1px 1px 5px rgba(' + color + ',0.8)')
					.css("border", "1px solid rgb(" + snd + ")");
				//big.find("div.albumResultAlbum").css("text-shadow","1px 1px 1px rgb(" + snd + ")");
				big.find('.primaryColor').css('color', 'rgb(' + pr + ')');
				big.find('.secondaryColor').css('color', 'rgb(' + snd + ')');
				big.find('.albumTrack').each(function(ix) {
					var trk = $(this);
					playlistDragger(trk, $(".albumTrack"), function(i, last) {
						Squeeze.addTrack(tracklist[ix].url, function() {
							if (!last) {
								Squeeze.move(Playlist.items.length - 1, i);
							}
						});
					});
				});
				$(window).trigger("resize");
				setTimeout(function() {
					tracks.show().removeClass("faded");
					hide.removeClass("faded");
					$(window).trigger("resize");
				}, 250)
				setTimeout(function() {
					$(window).trigger("resize");

				}, 350);
				setTimeout(function() {
					$(window).trigger("resize");
					big.find(".albumResultControls").fadeIn();
				}, 1000);

			}, 50);
			t.removeClass("albumResultSelected");


			big.find(".albumResultAdd").click(function() {
				Squeeze.addAlbum(a.id);
			});
			big.find(".albumResultPlay").click(function() {
				Squeeze.playAlbum(a.id);
			});
		}, true);
	});
}

var showAlbums = function() {
	var i = albumIndex;
	if (results.albums.length === 0) {
		return $("#searchView").parent().hide();
	}
	$("#searchView").parent().show();
	$("#searchView").text("Albums - " + results.albums.length);
	for (i; i < Math.min(results.albums.length, 200 + albumIndex); i++) {
		var a = results.albums[i]
		var t = albumTemplate.clone();
		t.attr("id", "albumId" + a.id);
		var im = t.find("img");
		var trk = Library.getTracks(a.id)[0];
		fetchCover(im, trk.coverid + "_150x150.png")
		t.find(".albumResultAlbum").text(a.album);
		t.find(".albumResultArtist").text(a.compilation * 1 === 1 ? "Various Artists" : Library.getArtist(a.artist_id).artist);
		t.find(".albumResultYear").text(trk.year & trk.year !== "0" ? " (" + trk.year + ")" : "");
		albumResults.append(t);
		t.removeClass("faded");
		albumSelector(t, a);
	};
}
var showTracks = function() {
	if (results.titles.length === 0) {
		return $("#tracksView").parent().hide();
	}
	$("#tracksView").parent().show();
	$("#tracksView").text("Tracks - " + results.titles.length);
	results.titles.map(function(a) {
		var t = trackTemplate.clone();
		var text = a.title + " - " + Library.getArtist(a.artist_id).artist + " - " + Library.getAlbum(a.album_id).album + (a.year !== "0" ? " (" + a.year + ")" : "");
		t.find(".trackDetail").text(text);
		t.find(".trackTrackDuration").text(toMinSec(Math.floor(parseInt(a.duration, 10))));
		$(".trackTracks").append(t);
		t.find(".trackTrackPlay").click(function() {
			Squeeze.playTrack(a.url, Playlist.items.length);
		});
		t.find(".trackTrackAddToEnd").click(function() {
			Squeeze.addTrack(a.url);
		});
		playlistDragger(t, $(".trackTrack"), function(i, last) {
			Squeeze.addTrack(a.url, function() {
				if (!last) {
					Squeeze.move(Playlist.items.length - 1, i);
				}
			});
		});
	});
};
$("#searchLibrary").keyup(function(e) {
	var t = $(this);
	if (t.val() === lastSearch || t.val().length < 3) {
		return;
	}
	clearTimeout(searchTimer);
	$(".albumResult").addClass("faded");
	searchTimer = setTimeout(function() {
		window.fetchCover.stop();
		$(".albumViewer").remove();
		$("#searchView").trigger("click");
		$(".albumResults").show();
		$(".trackResults").hide();
		$(".trackTracks").empty();
		albumResults.empty();
		lastSearch = t.val();

		results = Library.search(lastSearch);
		results.artists.map(function(art) {
			Library.getAlbums(art.id).map(function(alb) {
				results.albums.push(alb);
			});
		});
		(function() {
			var o = {}, i, l = results.albums.length,
				r = [];
			for (i = 0; i < l; i = i + 1) {
				o[results.albums[i].id] = results.albums[i];
			}
			for (i in o) {
				if (o.hasOwnProperty(i)) {
					r.push(o[i]);
				}
			}
			results.albums = r;
		}());
		//sort by artist and album
		results.albums.sort(function(a, b) {
			return a.artist_id === b.artist_id ?
				(a.album.toLowerCase() > b.album.toLowerCase() ? 1 : -1) :
				Library.getArtist(a.artist_id).artist.toLowerCase() > Library.getArtist(b.artist_id).artist.toLowerCase() ? 1 : -1;
		});
		results.titles.sort(function(a, b) {
			return Library.getArtist(a.artist_id).artist.toLowerCase() > Library.getArtist(b.artist_id).artist.toLowerCase() ? 1 : -1;
		});
		showAlbums();
		showTracks();
		if (results.albums.length === 0) {
			$("#tracksView").trigger("click");
		}

	}, 500);
});
$(window).keyup(function(e) {
	if ((e.keyCode || e.charCode) === 13) {
		e.stopImmediatePropagation();
		return false;
	}
	if ((e.keyCode || e.charCode) === 27 && $(".albumViewer").is(":visible")) {
		$(".albumViewer").addClass("faded");
		$(".albumResult").not(".albumViewer").removeClass("mostlyFaded");
		setTimeout(function() {
			$(".albumViewer").remove();
		}, 500);
	}
});