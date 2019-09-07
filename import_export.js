function current_format_version() {
	return 5;
	// format version history:
	// 2: removed 'current_sr', 'max_sr fields'. Offence and defence class merged to dps;
	// 3: added 'last_updated' field ( stats last updated Date ) [Date];
	// starting with v4 not compatible with tournament balancer
	// 4: added 'private_profile' field [Boolean];
	// 5: remover sr fields, added sr_by_class [struct] and playtime_by_class [struct]; top_classes renamed to classes;
	//		added optional 'format_type' field to header to distinguish customs and tournament balancer formats
}

function export_lobby( format ) {
	var export_str = "";
	if ( format == "json" ) {
		var export_struct = {
			format_version: current_format_version(),
			format_type: "customs",
			players: lobby
			};
		export_str = JSON.stringify(export_struct, null, ' ');
	} else if ( format == "text" ) {
		for( i in lobby) {
			var player_id = lobby[i].id.trim().replace("-", "#");
			export_str += player_id + "\n";
		}
	} else if ( format == "csv" ) {
		export_str += "BattleTag,Name,Level,Tank SR,DPS SR,Support SR,Main class,Main hero,Last updated,Private profile\n";
		for( i in lobby) {
			var player_id = lobby[i].id.trim().replace("-", "#");
			var main_class = "";
			if( lobby[i].classes[0] !== undefined ) main_class = lobby[i].classes[0];			
			var main_hero = "";
			if( lobby[i].top_heroes[0] !== undefined ) main_hero = lobby[i].top_heroes[0].hero;
			var last_updated = lobby[i].last_updated.toISOString();
			var sr_tank = is_undefined( lobby[i].sr_by_class["tank"], 0);
			var sr_dps = is_undefined(lobby[i].sr_by_class["dps"], 0);
			var sr_support = is_undefined(lobby[i].sr_by_class["support"], 0);
			
			export_str += player_id+","+lobby[i].display_name+","+lobby[i].level
						+","+sr_tank+","+sr_dps+","+sr_support
						+","+main_class+","+main_hero+","+last_updated+","+lobby[i].private_profile+"\n";
		}
	}
	
	return export_str.trim();
}

function export_teams( format, include_players, include_sr, include_classes, include_captains, table_columns ) {
	var setup_str = "";
	
	if ( format == "text-list" ) {
		if ( is_role_lock_enabled() ) {
			var teams = [team1_slots, team2_slots];	
			for ( var t in teams ) {
				setup_str += get_team_name(Number(t)+1)+ "\n";
				if ( include_players ) {
					for( var class_name in teams[t] ) {
						for ( var player of teams[t][class_name] ) {
							var player_str = "";
							
							player_str += class_name + "\t";
							
							if ( include_sr ) {
								var player_sr = get_player_sr( player, class_name );
								player_str += player_sr + "\t";
							}
							player_str += player.display_name + "\t";
							
							if ( include_classes ) {
								player_str += player.classes.join("/");
							}
							
							setup_str += player_str + "\n";
						}
					}
				}
			}
			setup_str += "\n";
		} else {
			var teams = [team1, team2];
			for ( var t in teams ) {
				setup_str += get_team_name(Number(t)+1) + "\n";
				if ( include_players ) {
					for ( var p in teams[t] ) {
						var player_str = "";
						if ( include_sr ) {
							var player_sr = get_player_sr( teams[t][p], Settings.sr_calc_method );
							player_str += player_sr + "\t";
						}
						player_str += teams[t][p].display_name;

						if ( include_classes ) {
							player_str += teams[t][p].classes.join("/");
						}
							
						setup_str += player_str + "\n";
					}
					setup_str += "\n";
				}
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
	
	if ( is_role_lock_enabled() ) {
		var teams = [team1_slots, team2_slots];	
	} else {
		var teams = [team1, team2];
	}
	
	var title_colspan = 1;
	if ( include_players ) {
		if ( include_sr ) title_colspan++;
		if ( include_classes ) title_colspan++;
		if ( is_role_lock_enabled() ) title_colspan++;
	}
	var _team_size = get_team_size();
	
	setup_str += "<table style='border-collapse: collapse; background-color: white;'>\n";
	
	for ( var row = 1; row <= Math.ceil(teams.length / table_columns); row++ ) {
		var team_offset = (row-1)*table_columns;
		// print titles
		setup_str += "<tr>";
		for ( var t = team_offset; t < team_offset+table_columns; t++ ) {
			if ( t >= teams.length ) break;
			setup_str += "<td colspan='"+title_colspan+
				"' style='text-align: center;background-color: gray; color: white; border: 1px solid gray;'>";
			setup_str += escapeHtml( get_team_name(Number(t)+1) );
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
					
					if ( is_role_lock_enabled() ) {
						var player = get_player_at_index( teams[t], p );
						var team_length = get_team_player_count( teams[t] );
						
						// print cell with slot class
						setup_str += "<td style='text-align: left; border-bottom: 1px solid gray; border-left: 1px solid gray; border-right: 1px solid gray; white-space: nowrap;'>";
						if ( p < team_length ) {
							var slot_role = get_player_role(teams[t], player);
							if (draw_icons) {
								var class_str = "<img style='filter: opacity(60%);' src='"+class_icons_datauri[slot_role]+"' alt='"+slot_role+"'/>";
							} else {
								var class_str = slot_role;
								if (class_str == "support") class_str = "sup";
							}
							setup_str += class_str;
						}
						setup_str += "</td>";
					} else {
						var player = teams[t][p];
						var team_length = teams[t].length
					}
					
					if ( include_sr ) {
						setup_str += "<td style='text-align: right; padding-right: 0.5em; border-bottom: 1px solid gray;border-left: 1px solid gray;'>";
						
						if ( is_role_lock_enabled() ) {
							if ( p < team_length ) {
								var player_sr = get_player_sr( player, get_player_role(teams[t], player) );
								if (draw_icons) {
									var rank_name = get_rank_name(player_sr);
									setup_str += "<img src='"+rank_icons_datauri[rank_name]+"' alt='"+rank_name+"'/>";
								} else {
									setup_str += player_sr;
								}
							}
						} else {
							if ( p < team_length ) {
								var player_sr = get_player_sr( player, Settings.sr_calc_method );
								if (draw_icons) {
									var rank_name = get_rank_name(player_sr);
									setup_str += "<img src='"+rank_icons_datauri[rank_name]+"' alt='"+rank_name+"'/>";
								} else {
									setup_str += player_sr;
								}
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
					if ( p < team_length ) {
						setup_str += escapeHtml( player.display_name );
					}
					setup_str += "</td>";
					
					if ( include_classes ) {
						setup_str += "<td style='text-align: left; border-bottom: 1px solid gray; border-right: 1px solid gray; white-space: nowrap;'>";
						if ( p < team_length ) {
							// main class
							if ( player.classes[0] != undefined ) {
								var class_name = player.classes[0];
								if (draw_icons) {
									var class_str = "<img style='filter: opacity(60%);' src='"+class_icons_datauri[class_name]+"'/>";
								} else {
									var class_str = class_name;
									if (class_str == "support") class_str = "sup";
								}
								
								setup_str += class_str;
							}
							// secondary class
							if ( player.classes[1] != undefined ) {
								var class_name = player.classes[1];
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
			if ( import_struct.format_version > current_format_version() ) {
				throw new Error("Unsupported format version: "+import_struct.format_version);
			}
			
			if ( import_struct.format_type !== undefined ) {
				if( import_struct.format_type != "customs" ) {
					throw new Error("Unsupported format type: "+import_struct.format_type);
				}
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
				// split string to fields (btag, tank SR, DPS SR, support SR, main class)
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
				if ( fields.length >= 4 ) {
					var index_offset = 1;
					for ( var class_index in class_names ) {
						var class_sr_text = fields[Number(class_index)+index_offset];
						var class_sr = Number(class_sr_text);
						if ( Number.isNaN(class_sr) ) {
							throw new Error("Incorrect SR number "+class_sr_text);
						}
						if ( class_sr < 0 || class_sr > 5000 ) {
							throw new Error("Incorrect SR value "+class_sr);
						}
						
						new_player.sr_by_class[ class_names[class_index] ] = class_sr;
					}
					
					new_player.last_updated = new Date;
				}
				if ( fields.length >= 5 ) {
					var class_name = fields[4];
					if (class_names.indexOf(class_name) == -1) {
						throw new Error("Incorrect class name "+class_name);
					}
					new_player.classes.push( class_name);
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
	
	init_team_slots(team1_slots);
	var saved_players_json = localStorage.getItem( storage_prefix+"team1_slots" );
	if ( saved_players_json != null ) {
		var saved_team = JSON.parse(saved_players_json);
		for ( let class_name in saved_team ) {
			for ( var i in saved_team[class_name] ) {
				team1_slots[class_name].push( sanitize_player_struct(saved_team[class_name][i], saved_format) );
			}
		}
	} 
	
	init_team_slots(team2_slots);
	var saved_players_json = localStorage.getItem( storage_prefix+"team2_slots" );
	if ( saved_players_json != null ) {
		var saved_team = JSON.parse(saved_players_json);
		for ( let class_name in saved_team ) {
			for ( var i in saved_team[class_name] ) {
				team2_slots[class_name].push( sanitize_player_struct(saved_team[class_name][i], saved_format) );
			}
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
	
	if ( saved_format <= 4 ) {
		// convert single SR to new separate rating by roles
		player_struct.classes = [];		
		player_struct.sr_by_class = {};
		player_struct.playtime_by_class = {};
		for( let class_name of player_struct.top_classes ) {
			player_struct.classes.push( class_name );
			player_struct.sr_by_class[class_name] = player_struct.sr;
			player_struct.playtime_by_class[class_name] = 0;
		}
		
		delete player_struct.top_classes;
		delete player_struct.sr;
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

function save_pinned_list() {
	localStorage.setItem(storage_prefix+"pinned_players", JSON.stringify(Array.from(pinned_players)));
}

function save_checkin_list() {
	localStorage.setItem(storage_prefix+"checkin", JSON.stringify(Array.from(checkin_list)));
}

function save_players_list() {
	// store players to browser local storage
	localStorage.setItem(storage_prefix+"lobby", JSON.stringify(lobby));
	localStorage.setItem(storage_prefix+"team1", JSON.stringify(team1));
	localStorage.setItem(storage_prefix+"team2", JSON.stringify(team2));
	localStorage.setItem(storage_prefix+"team1_slots", JSON.stringify(team1_slots));
	localStorage.setItem(storage_prefix+"team2_slots", JSON.stringify(team2_slots));
	localStorage.setItem(storage_prefix+"saved_format", current_format_version());
}
