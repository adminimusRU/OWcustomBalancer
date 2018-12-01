function export_lobby( format ) {
	var export_str = "";
	if ( format == "json" ) {
		var export_struct = {
			format_version: 4,
			players: lobby
			};
		export_str = JSON.stringify(export_struct, null, ' ');
	} else if ( format == "text" ) {
		for( i in lobby) {
			var player_id = lobby[i].id.trim().replace("-", "#");
			export_str += player_id + "\n";
		}
	} else if ( format == "csv" ) {
		export_str += "BattleTag,Name,SR,Level,Main class,Secondary class,Main hero,Last updated,Private profile\n";
		for( i in lobby) {
			var player_id = lobby[i].id.trim().replace("-", "#");
			var main_class = "";
			if( lobby[i].top_classes[0] !== undefined ) main_class = lobby[i].top_classes[0];
			var secondary_class = "";
			if( lobby[i].top_classes[1] !== undefined ) secondary_class = lobby[i].top_classes[1];
			var main_hero = "";
			if( lobby[i].top_heroes[0] !== undefined ) main_hero = lobby[i].top_heroes[0].hero;
			var last_updated = lobby[i].last_updated.toISOString();
			
			export_str += player_id+","+lobby[i].display_name+","+lobby[i].sr
						+","+lobby[i].level+","+main_class+","+secondary_class+","+main_hero+","+last_updated+","+lobby[i].private_profile+"\n";
		}
	}
	
	return export_str.trim();
}

function export_teams( format, include_players, include_sr, include_classes, include_captains, table_columns ) {
	var setup_str = "";
	
	if ( format == "text-list" ) {
		var teams = [team1, team2];
		for ( var t in teams ) {
			setup_str += document.getElementById("team"+(Number(t)+1)+"_name").value + "\n"; // @Todo proper team title
			if ( include_players ) {
				for ( var p in teams[t] ) {
					var player_str = "";
					if ( include_sr ) {
						player_str += teams[t][p].sr + "\t";
					}
					player_str += teams[t][p].display_name;

					if ( include_classes ) {
						if ( teams[t][p].top_classes[0] != undefined ) {
							player_str += "\t" + teams[t][p].top_classes[0];
						}
						if ( teams[t][p].top_classes[1] != undefined ) {
							player_str += "/" + teams[t][p].top_classes[1];
						}
					}
					setup_str += player_str + "\n";
				}
				setup_str += "\n";
			}
		}
	} else if ( format == "html-table" ) {
		setup_str = export_teams_html( format, include_players, include_sr, include_classes, include_captains, table_columns, false );
	} else if ( format == "image" ) {
		setup_str = export_teams_html( format, include_players, include_sr, include_classes, include_captains, table_columns, true );
	}
	
	return setup_str.trim();
}

function export_teams_html( format, include_players, include_sr, include_classes, include_captains, table_columns, draw_icons ) {
	var setup_str = "";
	var teams = [team1, team2];
	
	var title_colspan = 1;
	if ( include_players ) {
		if ( include_sr ) title_colspan++;
		if ( include_classes ) title_colspan++;
	}
	var _team_size = Settings.team_size;
	
	setup_str += "<table style='border-collapse: collapse; background-color: white;'>\n";
	
	for ( var row = 1; row <= Math.ceil(teams.length / table_columns); row++ ) {
		var team_offset = (row-1)*table_columns;
		// print titles
		setup_str += "<tr>";
		for ( var t = team_offset; t < team_offset+table_columns; t++ ) {
			if ( t >= teams.length ) break;
			setup_str += "<td colspan='"+title_colspan+
				"' style='text-align: center;background-color: gray; color: white; border: 1px solid gray;'>";
			setup_str += escapeHtml( document.getElementById("team"+(Number(t)+1)+"_name").value ); // @Todo proper team title
			setup_str += "</td>";
			// vertical spacer
			setup_str += "<td style='width: 1em;'></td>";
		}
		setup_str += "</tr>\n";
		
		// print players
		if ( include_players ) {
			for ( var p = 0; p < _team_size; p++ ) {
				setup_str += "<tr>";
				for ( var t = team_offset; t < team_offset+table_columns; t++ ) {
					if ( t >= teams.length ) break;
					
					if ( include_sr ) {
						setup_str += "<td style='text-align: right; padding-right: 0.5em; border-bottom: 1px solid gray;border-left: 1px solid gray;'>";
						if ( p < teams[t].length ) {
							if (draw_icons) {
								var rank_name = get_rank_name(teams[t][p].sr);
								setup_str += "<img src='"+rank_icons_datauri[rank_name]+"'/>";
							} else {
								setup_str += teams[t][p].sr;
							}
						}
						
						setup_str += "</td>";
					}
					
					var borders = "border-bottom: 1px solid gray;";
					if ( ! include_sr ) {
						borders += "border-left: 1px solid gray;";
					}
					if ( ! include_classes ) {
						borders += "border-right: 1px solid gray;";
					}
					setup_str += "<td style='text-align: left; padding: 0.2em; white-space: nowrap; "+borders+"'>";
					if ( p < teams[t].length ) {
						setup_str += escapeHtml( teams[t][p].display_name );
					}
					setup_str += "</td>";
					
					if ( include_classes ) {
						setup_str += "<td style='text-align: left; border-bottom: 1px solid gray; border-right: 1px solid gray; white-space: nowrap;'>";
						if ( p < teams[t].length ) {
							// main class
							if ( teams[t][p].top_classes[0] != undefined ) {
								var class_name = teams[t][p].top_classes[0];
								if (draw_icons) {
									var class_str = "<img style='filter: opacity(60%);' src='"+class_icons_datauri[class_name]+"'/>";
								} else {
									var class_str = class_name;
									if (class_str == "support") class_str = "sup";
								}
								
								setup_str += class_str;
							}
							// secondary class
							if ( teams[t][p].top_classes[1] != undefined ) {
								var class_name = teams[t][p].top_classes[1];
								if (draw_icons) {
									var class_str = "<img style='height: 15px; width: auto; filter: opacity(40%);' src='"+class_icons_datauri[class_name]+"'/>";
								} else {
									var class_str = class_name;
									if (class_str == "support") class_str = "sup";
									class_str = "/"+class_str;
								}
								
								setup_str += class_str;
							}
						}
						setup_str += "</td>";
					}
					// vertical spacer
					setup_str += "<td></td>";
				}
				setup_str += "</tr>\n";
			}
		}
		
		// horizontal spacer
		setup_str += "<tr style='height: 1em;'></tr>";
	}
	
	setup_str += "</table>\n";
	
	return setup_str;
}

function import_lobby( format, import_str ) {
	var added_players = [];
	var players_for_update = [];

	if (import_str == null || import_str == "") {
		return;
	}
	if ( format == "json" ) {
		try {
			// try to parse json
			var import_struct = JSON.parse(import_str);
			
			// check format
			if ( import_struct.format_version > 4 ) {
				throw new Error("Unsupported format version");
			}
			
			for( var i=0; i<import_struct.players.length; i++) {
				var imported_player = import_struct.players[i];
				
				// check duplicates
				if (find_player_by_id(imported_player.id) !== undefined ) {
					continue;
				}
				
				imported_player = sanitize_player_struct( imported_player, import_struct.format_version );
				added_players.push( imported_player );
			}
		}
		catch(err) {
			// try to parse as plain battletag list?
			alert("Incorrect import format: "+err.message);
			return false;
		}
	} else if( format == "text") {
		try {
			var battletag_list = import_str.trim().split("\n");
			for( i in battletag_list ) {
				// split string to fields (btag, SR, class, offclass)
				var fields = battletag_list[i].split(/[ \t.,;|]+/);
				
				// @ToDo check battletag format ?				
				var player_id = format_player_id(fields[0]);

				// check duplicates
				if (find_player_by_id(player_id) !== undefined ) {
					continue;
				}
				var player_name = format_player_name( player_id );
				
				var new_player = create_empty_player();
				delete new_player.empty;
				new_player.id = player_id;
				new_player.display_name = player_name;
				
				// additional fields
				if ( fields.length >= 2 ) {
					new_player.sr = Number( fields[1] );
					if ( Number.isNaN(new_player.sr) ) {
						throw new Error("Incorrect SR number "+fields[1]);
					}
					if ( new_player.sr < 0 || new_player.sr > 5000 ) {
						throw new Error("Incorrect SR value "+fields[1]);
					}
					new_player.last_updated = new Date;
				}
				if ( fields.length >= 3 ) {
					for ( var c = 2; c < fields.length; c++ ) {
						if (class_names.indexOf(fields[c]) == -1) {
							throw new Error("Incorrect class name "+fields[c]);
						}
						new_player.top_classes.push( fields[c] );
					}
				}
				
				if ( fields.length == 1 ) {
					players_for_update.push( new_player );
				}
				added_players.push( new_player );
			}
		} 
		catch(err) {
			alert("Incorrect import format: "+err.message);
			return false;
		}
		
		// get stats for added players
		if (players_for_update.length > 0) {
			StatsUpdater.addToQueue( players_for_update );
		}
	} else {
		alert("Unknown import format: "+format);
		return false;
	}
	
	for( var p in added_players ) {
		lobby.push( added_players[p] );
	}
		
	redraw_lobby();
	save_players_list();
	
	// highlight all new players and scroll to show last one
	if (added_players.length > 0) {
		setTimeout( function() {document.getElementById( added_players[added_players.length-1].id ).scrollIntoView(false);}, 100 );
		setTimeout( function() {highlight_players( added_players );}, 500 );
	}
	return true;
}

function prepare_datauri_icons() {
	for ( var c in class_names ) {
		var image = new Image();
		image.class_name = class_names[c];

		image.onload = function () {
			var img_size_px = 20;
			
			// downscale in 3 steps to get better quality with offscreen canvas
			var oc = document.createElement('canvas');
			var octx = oc.getContext('2d');
			oc.width = this.width  * 0.5;
			oc.height = this.height * 0.5;
			octx.drawImage(this, 0, 0, oc.width, oc.height);
			
			var oc2 = document.createElement('canvas');
			var octx2 = oc2.getContext('2d');
			oc2.width = oc.width  * 0.5;
			oc2.height = oc.height * 0.5;
			octx2.drawImage(oc, 0, 0, oc.width * 0.5, oc.height * 0.5);

			var oc3 = document.createElement('canvas');
			var octx3 = oc3.getContext('2d');
			oc3.width = img_size_px;
			oc3.height = img_size_px;
			octx3.drawImage(oc2, 0, 0, img_size_px, img_size_px);
			
			class_icons_datauri[this.class_name] = oc3.toDataURL('image/png');
		};

		image.src = "class_icons/"+class_names[c]+".png";
	}
	
	for ( var rank_name in ow_ranks ) {
		var image = new Image();
		image.rank_name = rank_name;

		image.onload = function () {
			var img_size_px = 20;
			
			// downscale in 3 steps to get better quality with offscreen canvas
			var oc = document.createElement('canvas');
			var octx = oc.getContext('2d');
			oc.width = this.width  * 0.5;
			oc.height = this.height * 0.5;
			octx.drawImage(this, 0, 0, oc.width, oc.height);
			
			var oc2 = document.createElement('canvas');
			var octx2 = oc2.getContext('2d');
			oc2.width = oc.width  * 0.5;
			oc2.height = oc.height * 0.5;
			octx2.drawImage(oc, 0, 0, oc.width * 0.5, oc.height * 0.5);

			var oc3 = document.createElement('canvas');
			var octx3 = oc3.getContext('2d');
			oc3.width = img_size_px;
			oc3.height = img_size_px;
			octx3.drawImage(oc2, 0, 0, img_size_px, img_size_px);
			
			rank_icons_datauri[this.rank_name] = oc3.toDataURL('image/png');
		};

		image.src = "rank_icons/"+rank_name+"_small.png";
	}
}

function restore_saved_teams() {
	var saved_format = localStorage.getItem( storage_prefix+"saved_format" );
	if ( saved_format === null ) {
		saved_format = 1;
	}
	
	var saved_players_json = localStorage.getItem( storage_prefix+"lobby" );
	if ( saved_players_json != null ) {
		var saved_team = JSON.parse(saved_players_json);
		for ( var i in saved_team ) {
			lobby.push( sanitize_player_struct(saved_team[i], saved_format) );
		}
	}
	
	var saved_players_json = localStorage.getItem( storage_prefix+"team1" );
	if ( saved_players_json != null ) {
		var saved_team = JSON.parse(saved_players_json);
		for ( var i in saved_team ) {
			team1.push( sanitize_player_struct(saved_team[i], saved_format) );
		}
	}
	
	var saved_players_json = localStorage.getItem( storage_prefix+"team2" );
	if ( saved_players_json != null ) {
		var saved_team = JSON.parse(saved_players_json);
		for ( var i in saved_team ) {
			team2.push( sanitize_player_struct(saved_team[i], saved_format) );
		}
	}
	
	// draw teams
	redraw_lobby();
	redraw_teams();
}

function sanitize_player_struct( player_struct, saved_format ) {	
	if ( ! Array.isArray(player_struct.top_classes) ) {
		player_struct.top_classes = [];
	}
	if ( ! Array.isArray(player_struct.top_heroes) ) {
		player_struct.top_heroes = [];
	}
	
	if ( saved_format == 1 ) {
		// delete deprecated fields, add new fields
		delete player_struct.current_sr;
		delete player_struct.max_sr;
		
		// convert offence and defence classes to dps
		if( (player_struct.top_classes[0] == "offence") || (player_struct.top_classes[0] == "defence") ) {
			player_struct.top_classes[0] = "dps";
		}
		if( (player_struct.top_classes[1] == "offence") || (player_struct.top_classes[1] == "defence") ) {
			player_struct.top_classes[1] = "dps";
		}
		if( (player_struct.top_classes[0] == "dps") && (player_struct.top_classes[1] == "dps") ) {
			player_struct.top_classes.pop();
		}
	}
	
	if ( saved_format <= 2 ) {
		player_struct.last_updated = new Date(0);
	}
	
	if ( saved_format <= 3 ) {
		player_struct.private_profile = false;
	}
	
	if ( saved_format >= 3 ) {
		// restore dates from strings
		if ( player_struct.last_updated !== undefined ) {
			player_struct.last_updated = new Date(player_struct.last_updated);
		} else {
			player_struct.last_updated = new Date(0);
		}
	}
	
	
	return player_struct;
}

function save_players_list() {
	// store players to browser local storage
	localStorage.setItem(storage_prefix+"lobby", JSON.stringify(lobby));
	localStorage.setItem(storage_prefix+"team1", JSON.stringify(team1));
	localStorage.setItem(storage_prefix+"team2", JSON.stringify(team2));
	localStorage.setItem(storage_prefix+"saved_format", 4);
}
