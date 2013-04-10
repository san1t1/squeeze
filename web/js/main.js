jQuery.fn.insertAt = function(index, element) {
  var lastIndex = this.children().size()
  if (index < 0) {
    index = Math.max(0, lastIndex + 1 + index)
  }
  this.append(element)
  if (index < lastIndex) {
    this.children().eq(index).before(this.children().last())
  }
  return this;
}
window.noOp = function(){};
window.toMinSec = function(t){
	var sec = (t %60);
	var min = (t-sec)/60;
	sec = sec.toString();
	return min+":"+(sec.length===1 ?"0":"")+sec;
};
var Slider = (function(){
	var slider = {}, tmr=false, tot=0, pos = 0;
	inner = $(".nowPlayingSliderInner");
	
	var position = function(){
		if (pos === 0){
			inner.removeClass("nowPlayingSliderInnerAnimation")
		}
		inner.css("width",tot === 0 ? "0%" :((pos/tot) * 100) +"%")
		if (!inner.hasClass("nowPlayingSliderInnerAnimation")){
			inner.addClass("nowPlayingSliderInnerAnimation");
		}
		$(".nowPlayingTime").text(toMinSec(pos)+"/" + toMinSec(tot));
	};
	var playPause = function(){
		if (Squeeze.status.playing){
			$(".mixerPlay").hide();
			$(".mixerPause").show();
		}
		else{
			$(".mixerPlay").show();
			$(".mixerPause").hide();
		}
	};
	$(".mixerPause").click(function(){
		Squeeze.pause();
		Squeeze.status.playing = false;
		playPause();
	});
	$(".mixerPlay").click(function(){
		Squeeze.play();
		Squeeze.status.playing = true;
		playPause();
	});
	$(".mixerPrevious").click(function(){
		var i = Squeeze.status.playlistIndex;
		if (i === Playlist.items.length){return;}
		i--;
		Squeeze.jumpTo(i)
	});
	$(".mixerNext").click(function(){
		var i = Squeeze.status.playlistIndex;
		if (i === Playlist.items.length){return;}
		i++;
		Squeeze.jumpTo(i)
	});
	var volume =function(){
		var v = Squeeze.status.volume/100;
		var inn = $(".mixerInnerVolume");
		var h = inn.parent().height() *v + "px";
		inn.height(h);
	};
	var volumeOuter = $(".mixerVolume");
	volumeOuter.click(function(e){
		var pc = (1-e.offsetY/volumeOuter.height()) * 100;
		Squeeze.volume(Math.floor(pc));
		Squeeze.status.volume = pc;
		volume();
	});
	slider.start = function(p,t){
		tot = t;
		pos = p
		position();
		playPause();
		volume();
		var lastId = false;
		$(window).trigger("resize");
		setInterval(function(){
			if (!Playlist.items){return;}
			Squeeze.getStatus(function(s){
				pos = Squeeze.playing.position;
				tot = Squeeze.playing.duration;
				position();
				volume();
				if (Playlist.items.length === 0){return;}
				var obj = Playlist.items[Squeeze.status.playlistIndex];
				if (obj.id !== lastId){
					setNowPlaying(obj, Squeeze.status.playlistIndex);
					lastId = obj.id;
					//check for corrupted playlist.
					if($(".playlistPlaying").attr("id") !== "trackId" +lastId){
						loadPlaylist();
					};
				}
				playPause();
				$(window).trigger("resize");
			});
		},1000);
		var np = $(".nowPlayingSliderOuter");
		np.click(function(e){
			var pc = e.offsetX/np.width();
			var d = Math.floor(Squeeze.playing.duration * pc);
			Squeeze.setPosition(d);
			Squeeze.status.playing.position = pos = d;
			position();
		});
	};
	
	return slider;
}());

var setNowPlaying=function(p,i){
	if (!p){
		return;
	}
	var x = $($(".playlistItem")[i]);
	if ("trackId"+p.id !== x.attr("id")){
		//Race condition - 
		//waiting for the playlist to update after a move or delete. Fades are happening.
		return setTimeout(function(){
			setNowPlaying(p,i);
		},100);
	}
	$(".playlistPlaying").removeClass("playlistPlaying");
	x.addClass("playlistPlaying");
	$(".playlist").scrollTop(0);
	if (Playlist.items.length === 0){
		console.log("no list");
		return
	}
	setTimeout(function(){	
		$(".playlist").scrollTop($(".playlistPlaying").position().top - 100);
	},0);
	var artist = Library.getArtist(p.artist_id).artist || p.artist;
	var album = Library.getAlbum(p.album_id).album;
	var toRemove = false;
	var hide = [".nowPlayingTitle",".nowPlayingSliderOuter",".nowPlayingTime"];
	if ($(".nowPlayingArtist").text() !== artist){hide.push(".nowPlayingArtist");}
	var loadCovers = function(){
		var im = $(".header").find("img");
		var im2 = $(".nowPlayingArea").find("img");
		im.addClass("faded");
		im2.addClass("faded");
		fetchCover(im, p.coverid+"_100x100.png",function(){
			im.removeClass("faded");
		});
		fetchCover(im2, p.coverid, function(){
			im2.removeClass("faded");
			var colors = colorCache[p.coverid] || getColors(im2);
				colorCache[p.coverid] = colors;
				var color =  colors[1].join(',');
				colors = inverseColors(colors[1], colors[0]);
				var pr = colors[0].join(","),snd = colors[1].join(",");
				
				$(".nowPlayingItem").css('background', 'rgba(' + pr+ ',0.6)');
				$(".nowPlayingItem").find('img.nowPlayingCover, div.nowPlayingDetailsHolder')
					.css('box-shadow', '-6px 6px 12px rgba('+color +',0.8) ')
					.css('text-shadow', '0.5px 0.5px 0.5px rgba('+snd +',0.8)')
					.css("border","1px solid rgb("+snd+ ")");
				//$(".nowPlayingItem").find("div.nowPlayingDetailsHolder").css("background","rgba("+snd+",0.8)").css("color","rgb("+pr+")");
				$(".nowPlayingItem").css('box-shadow', '-20px 20px 20px rgba('+color +',0.8)').css("border","1px solid rgba("+snd+ ",0.8)");
		});
	}
	if ($(".nowPlayingAlbum").text() !== album){
		hide.push(".nowPlayingArtist"); 
		loadCovers();
	}
	if (hide.length === 3 && $(".nowPlayingTitle").text() ===p.title){return;}
	$(hide.join(",")).addClass("faded");
	setTimeout(function(){
		$(".nowPlayingTitle").text(p.title);
		$(".nowPlayingArtist").text(artist);
		$(".nowPlayingAlbum").text(album);
		loadCovers();
		$(".header, .nowPlayingArea").find(".faded").removeClass("faded");
		if(toRemove){toRemove.detach();}
	},500)
};

var makePlaylistItem =function(p,i){
	var t = playlistTemplate.clone();
	t.attr("id","trackId"+p.id);
	var im = t.find("img");
	fetchCover(im, p.coverid+"_50x50.png");
	t.find(".playlistTitle").text(p.title);
	t.find(".playlistArtist").text(Library.getArtist(p.artist_id).artist || p.artist || "");
	t.find(".playlistAlbum").text(Library.getAlbum(p.album_id).album || "");
	if (i === Squeeze.status.playlistIndex){
		t.addClass("playlistPlaying");
	}
	var findIndex = function(){
		var items = $(".playlistItem"), i=0;
		for (i; i<items.length; i++){
			if (t.is($(items[i]))){
				return i;
			}
		}
	};
	t.find(".playlistRemove").click(function(e){
		Squeeze.remove(findIndex());
		return false;
	});
	t.find(".playlistPlay").click(function(e){
		Squeeze.jumpTo(findIndex());
		return false;
	});
	playlistDragger(t);
	return t;
};

var playlistTemplate;
var loadPlaylist = function(){
	$(".playlist").empty();
	for (var i=0; i<Playlist.items.length; i++){	
		$(".playlist").append(makePlaylistItem(Playlist.items[i],i));	
	}
};
var removeFromPlaylist = function(p){
	console.log("remove",p);
	var t= $("#trackId"+p[0].id);
	t.fadeOut(t.detach);
};
var dragItem, dragBefore, dragAfter, dragTarget, dragFn, inhibitCursor = false;
$("body").on("mousemove",function(e){
	if (dragItem){
		dragItem.css({left:e.pageX,top:e.pageY});
	}
	else{
		$(".dragItem").remove();
		if (inhibitCursor){
			inhibitCursor.removeClass("noPointer");
		}
	}
}).on("mouseup", function(e){
	if (dragItem){
		dragItem.detach();
		dragItem = null;
		//$(".playlistItem").removeClass("noPointer");
	}
});
$(".playlist").on("mouseout", function(){
	if (dragTarget){
		dragTarget.detach();
	}
});
var playlistMove = function(e,last){
	if (dragItem){
		var plist = $(".playlist");
		var t = $(this);
		if (t.hasClass("albumTrack")){return;}
		
		if (!dragTarget){
			dragTarget = $("<div class='dragTarget'>");
		}
		if (!last){
			if (!dragBefore){
				dragBefore = t;
			}
			
			if (dragBefore && dragBefore.attr("id") === "trackId" +Playlist.items[0].id & e.offsetY/dragBefore.height()< 0.5){
				if (dragAfter === t){return;}
				dragAfter = dragBefore;
				dragBefore = false
				return dragTarget.detach().insertBefore(dragAfter);
			}
			if (dragBefore === t){return;}
			dragBefore = t;	
			dragAfter = false;
			dragTarget.detach().insertAfter(dragBefore);
		}
		else{
			dragBefore =false;
			dragAfter = false;
			plist.append(dragTarget.detach());
		}

		
	}
};
$(".playlist").mousemove(function(e){
	if (dragItem && $(e.target).is($(".playlist"))){
		var it = $(".playlistItem").last();
		if (it.position().top + it.height() < e.offsetY){
			playlistMove(e,true);
		}
	}
}).mouseup(function(){
	if (dragItem && dragTarget && $(".playlist").children().last().is(dragTarget)){
		dragFn(false, true);
	}
});

var playlistDragger = function(p, inhibits, f){
	var dragTimer = false;
	p.on("mousedown",function(e){
		if (e.button !==0){return;}
		inhibitCursor = inhibits;
		var et = $(e.target);
		if (et.hasClass("icon-play") || et.hasClass("icon-remove-sign") || et.hasClass("icon-plus-sign")){return;}
		dragTimer = setTimeout(function(){
			var all = $(".playlistItem");
			var c = p.clone();
			c.find(".playlistControls").remove()
			c.find(".albumTrackControls").remove();
			c.css("width",p.css("width")).css("height",p.css("height")).addClass("dragItem");
			var i = 0;
			for (i; i<all.length;i++){
				if ($(all[i]).attr("id") === c.attr("id")){
					break;
				}
			}
			dragItem = c;
			var dragSource = p;
			
			var i=0, items = $(".playlistItem"); 
			for (i; i<items.length; i++){
				if ($(items[i]).is(p)){
					dragSource = i;
					break;
				}
			}
			dragFn = f || function(index, last){
				if (index === dragSource){
					dragFn = function(){};
				}
				else{
					if (last){
						Squeeze.move(dragSource, Playlist.items.length-1);	
					}
					else{
						Squeeze.move(dragSource,index > dragSource ? index -1 : index);
					}
				}
			};
			dragItem.css({left:e.pageX,top:e.pageY});
			$("body").append(dragItem);
			if (inhibitCursor){
				inhibitCursor.addClass("noPointer");
			}
			else{
				$(".dragItem>.playlistTitle, .dragItem>.playlistArtist, .dragItem>.playlistCover, .dragItem>.playlistAlbum").addClass("noPointer");
				$(".playlistTitle, .playlistArtist, .playlistCover, .playlistAlbum").addClass("noPointer");
			}
			
		},250);
	}).on("mousemove",playlistMove).on("mouseup",function(e){
		clearTimeout(dragTimer);
		var et = $(e.target);
		if (et.hasClass("icon-play") || et.hasClass("icon-remove-sign")){return;}
		var target = $(".dragTarget");
		$(".dragItem, .dragTarget").fadeOut(function(){
			$(this).remove();
			dragItem = false;
			dragTarget = false;
		})
		if (target.length > 0){
			var items = $(".playlistItem");
			var next = target.next()[0];
			var i=0, from,to;
			for (i; i<items.length; i++){
				var j = items[i];
				if (j === next){
					if (inhibitCursor){
						inhibitCursor.removeClass("noPointer");
					}
					dragFn(i);
					break;
				}
			}
		}
		if (inhibitCursor){
			inhibitCursor.removeClass("noPointer");
		}else{
			$(".playlistTitle, .playlistArtist, .playlistCover, .playlistAlbum").removeClass("noPointer");
		}
	});
};

$("#nowPlayingView").click(function(){
	$(".albumViewer").remove();
	$(".searchResults").addClass("faded");
	$(".nowPlayingArea").removeClass("faded");
	$(this).parent().addClass("active");
	$("#searchView, #recentsView").parent().removeClass("active");
});
$("#searchView").click(function(){
	if ($(this).parent().hasClass("active")){
		return;
	}
	$(".albumResults").empty();
	$(this).parent().addClass("active");
	$("#nowPlayingView, #recentsView").parent().removeClass("active");
	$(".searchResults").removeClass("faded");
	$(".nowPlayingArea").addClass("faded");
});
$("#recentsView").click(function(){
	$(this).parent().addClass("active");
	$("#nowPlayingView, #searchView").parent().removeClass("active");
	$(".albumResults").empty();
	$(".searchResults").removeClass("faded");
	$(".nowPlayingArea").addClass("faded");
	Library.getRecentAlbums();
	showAlbums();
});

$(document).ready(function(){
	var searchContainer= $(".search");
	var searchResults= $(".searchResults, .nowPlayingArea");
	var playlistContainer= $(".playlist");
	var headerContainer= $(".header");
	$(window).resize(function(){
		var h = $(window).height() 
		playlistContainer.height(h- playlistContainer.position().top - 15);
		searchContainer.height(h- searchContainer.position().top - 15);
		searchResults.height(searchContainer.height() - searchResults.position().top - 15);
		var at = $(".albumTracks:visible");
		if (at.length > 0){
			var tracksHeight = at.parent().parent().height() -255;
			at.css("max-height",tracksHeight);
			var bgHeight = at.height()+at.position().top +20;
			$(".albumViewer>.albumResultBackground").height(bgHeight);
			var coverBottom = $(".albumViewer>.albumResultCover").height() + 140;
			$(".albumViewer").height(Math.max(coverBottom, bgHeight +50));
			$(".albumResultControls").css("top",coverBottom -80);
		}
	/*	$(".nowPlayingArea").find("div.nowPlayingCover").each(function(){
			var c = $(this);
			var w = c.height();
			c.width(c.height()).css("left", (c.parent().width() - w)/2);
		});
		var details = $(".nowPlayingDetailsHolder");
		details.css("margin-left", (details.parents().width()-details.width())/2);*/

	}).trigger("resize");
	playlistTemplate = $(".playlistItem").detach();
});
Squeeze.connect(function(){
	console.log("squeeze connected", Squeeze.serverStatus, Squeeze.status, Squeeze.playing);
	Slider.start(Squeeze.playing.position,Squeeze.playing.duration);
	Library.init(function(){
		Playlist.startSong(function(p){
			setNowPlaying(p, Squeeze.status.playlistIndex);
		});
		Playlist.reset(function(){
			loadPlaylist();
			setNowPlaying(Playlist.items[Squeeze.status.playlistIndex],Squeeze.status.playlistIndex);
		});
		Playlist.deleted(function(p){
			removeFromPlaylist(p);
		});
		Playlist.added(function(p,i){
			var pl = makePlaylistItem(p,i).hide();
			$(".playlist").insertAt(i+1,pl);
			pl.fadeIn();
		});
		Playlist.moved(function(from,to){
			var p = $($(".playlistItem")[from]);
			p.fadeOut(function(){
				p.detach();
				if (to === 0){
					$(".playlist").prepend(p);
				}
				else{
					p.insertAfter(($(".playlistItem")[to-1]));
				}
				p.fadeIn();
			});
		});
		Playlist.empty(function(){
			$(".playlist").empty();
		});
		Playlist.init(function(p){
			$(".pleaseWait").remove();
			$(".playlist, .header, .search").css("-webkit-transition","opacity 0.5s ease-in-out").removeClass("faded");
			loadPlaylist();
			setNowPlaying(Playlist.items[Squeeze.status.playlistIndex],Squeeze.status.playlistIndex);
		});
	});
});