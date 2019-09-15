/*
*		User actions
*/


function add_player_click() {
	var player_id = document.getElementById("new_player_id").value;
	player_id = format_player_id( player_id );
	
	// check duplicates
	if ( find_player_by_id(player_id) !== undefined ) {
		alert("Player already added");
		setTimeout( function() {document.getElementById(player_id).scrollIntoView(false);}, 100 );
		setTimeout( function() {highlight_player( player_id );}, 500 );
		return;
	}
		
	document.getElementById("add_btn").disabled = true;
	
	player_being_added = create_empty_player();
	player_being_added.id = player_id;
	
	StatsUpdater.addToQueue( player_being_added, 0, true );
}

function add_test_players() {
	// fill teams with ramdom players
	var number_to_add_str = prompt("Enter number of players to generate", 1);

	if (number_to_add_str === null) {
		return;
	}
	var number_to_add = Number(number_to_add_str);
	if( Number.isNaN(number_to_add) ) {
		return;
	}
	if( ! Number.isInteger(number_to_add) ) {
		return;
	}
	
	if( (number_to_add > 10000) || (number_to_add == 0) ) {
		return;
	}

	var added_players = [];
	for( var i=1; i<=number_to_add; i++ ) {
		var new_player = create_random_player(i);
		if ( find_player_by_id(new_player.id) !== undefined ) {
			continue;
		}
		lobby.push( new_player );
		added_players.push( new_player.id );
	}

	save_players_list();
	redraw_lobby();
	
	// highlight all new players and scroll to show last one
	setTimeout( function() {document.getElementById( added_players[added_players.length-1] ).scrollIntoView(false);}, 100 );
	setTimeout( function() {highlight_players( added_players );}, 500 );
}

function apply_settings() {
	var teams_changed = false;
	
	if ( Settings["sr_calc_method"] != document.getElementById("sr_calc_method").value ) {
		if ( ! is_role_lock_enabled() ) {
			teams_changed = true;
		}
	}
	
	// check if team size changed	
	var slots_count_setting = "slots_count";
	old_team_size = get_team_size();
	var new_team_size = 0;
	// compare slots count for each role, move players to lobby if slots reduced
	for ( class_name in Settings[slots_count_setting] ) {
		var setting_input = document.getElementById(slots_count_setting+"_"+class_name);
		var old_slot_count = Settings[slots_count_setting][class_name];
		new_slot_count = Number(setting_input.value);
		new_team_size += new_slot_count;
		
		if ( new_slot_count < new_slot_count ) {
			// team size old_slot_count - move excess players back to lobby
			teams_changed = true;
			while ( team1_slots[class_name].length > new_slot_count ) {
				let removed_player = team1_slots[class_name].pop();
				lobby.push( removed_player );
			}
			while ( team2_slots[class_name].length > new_slot_count ) {
				let removed_player = team2_slots[class_name].pop();
				lobby.push( removed_player );
			}
		}
		
		Settings[slots_count_setting][class_name] = new_slot_count;
	}
	// also move players out of old plain arrays
	if ( new_team_size < old_team_size ) {
		for ( let team of [team1, team2] ) {
			while ( team.length > new_team_size ) {
				let removed_player = team.pop();
				lobby.push( removed_player );
			}
		}
	}
	
	// fill settings struct from dialog	
	for ( setting_name in Settings ) {
		if ( setting_name == "slots_count" ) {
			continue;
		}
		
		var setting_input = document.getElementById(setting_name);
		var setting_value;
		
		switch( setting_input.type ) {
			case "checkbox":
				setting_value = setting_input.checked;
				break;
			case "number":
			case "range":
				setting_value = Number(setting_input.value);
				break;
			default:
				setting_value = setting_input.value;
		}
		
		Settings[setting_name] = setting_value;
	}
	
	localStorage.setItem( storage_prefix+"settings", JSON.stringify(Settings) );
	apply_stats_updater_settings();
	close_dialog( "popup_dlg_settings" );
	
	if (teams_changed) {
		save_players_list();
		redraw_lobby();
		redraw_teams();
	}
}

function balance_teams() {
	// send balancer settings to worker
	balancer_settings = {
		slots_count: 	Settings.slots_count,	
		algorithm: 		Settings.balancer_alg,	
		separate_otps: 	Settings.separate_otps,	
		adjust_sr: 		Settings.adjust_sr,
		adjust_sr_by_class: {
				tank: Settings.adjust_tank,
				dps: Settings.adjust_dps,
				support: Settings.adjust_support,
			},
		balance_priority_classic: Settings.balance_priority,
		classic_sr_calc_method: Settings.sr_calc_method,
		balance_priority_rolelock: Settings.balance_priority_rolelock,
	};
	
	BalanceWorker.postMessage(["settings", balancer_settings]);
	
	// copy players (references) to balancer input
	var players = team1.slice();
	for( let class_name in team1_slots ) {
		players = players.concat( team1_slots[class_name] );
	}
	players = players.concat( team2 );
	for( let class_name in team2_slots ) {
		players = players.concat( team2_slots[class_name] );
	}
	
	// start balance calculation
	BalanceWorker.postMessage(["balance", players]);	
	
	// show progress bar
	document.getElementById("dlg_progress_bar").value = 0;
	document.getElementById("dlg_progress_text").innerHTML = "0 %";
	document.getElementById("dlg_progress_cancel").style.display = "";
	document.getElementById("dlg_progress_close").style.display = "none";
	open_dialog( "popup_dlg_progress" );
}

function cancel_balance() {
	BalanceWorker.terminate();
	close_dialog( "popup_dlg_progress" );
	BalanceWorker = new Worker('balance_worker.js');
	BalanceWorker.onmessage = on_balance_worker_message;
	BalanceWorker.postMessage(["init"]);
}

function clear_lobby() {
	if( confirm("Permanently delete all players?") ) {
		while ( lobby.length > 0 ) {
			var player_to_delete = lobby.pop();
			
			// remove from checkin
			checkin_list.delete(player_to_delete.id);
			
			// remove from pinned
			pinned_players.delete(player_to_delete.id);
		}
		
		save_players_list();
		save_checkin_list();
		save_pinned_list();
		redraw_lobby();
	}
}

function clear_edited_mark( field_name ) {
	if (player_being_edited == undefined) {
		return;
	}
	
	var player_struct = player_being_edited;
	
	switch (field_name) {
		case 'ne': 
			player_struct.ne = false;
			document.getElementById("dlg_player_name_edited").style.visibility = "";
			break;
		case 'se': 
			player_struct.se = false;
			var marks = document.getElementById("dlg_player_class_table").getElementsByClassName("dlg-edited-mark-sr");
			for( i=0; i<marks.length; i++ ) {
				marks[i].style.visibility = "hidden";
			}
			break;
		case 'ce': 
			player_struct.ce = false;
			document.getElementById("dlg_player_class1_edited").style.visibility = "";
			break;
	}
	
	redraw_player( player_struct );
	save_players_list();
}

function clear_stats_update_log() {
	document.getElementById("stats_update_log").value = "";
	document.getElementById("stats_update_errors").style.visibility = "hidden";
}

function close_dialog( dialog_id ) {
	document.getElementById( dialog_id ).style.display = "none";
}

function edit_player_ok() {
	if (player_being_edited == undefined) {
		return;
	}
	
	var player_struct = player_being_edited;
	
	var new_name = document.getElementById("dlg_player_display_name").value;
	if ( player_struct.display_name != new_name ) {
		player_struct.ne = true; // name edited
	}
	player_struct.display_name = new_name;
	
	var class_rows = document.getElementById("dlg_player_class_table").rows;
	// check if SR was edited
	for ( var i=0; i<class_rows.length; i++ ) {
		var class_row = class_rows[i];
		var class_title = class_row.getElementsByClassName("dlg-class-name")[0];
		var class_name = class_title.innerHTML;
		
		var sr_edit = class_row.getElementsByClassName("dlg-sr-by-class")[0];
		var new_sr = Number(sr_edit.value);
		
		var old_sr = player_struct.sr_by_class[class_name];
		if ( old_sr == undefined ) {
			old_sr = 0;
		}
		
		if ( old_sr != new_sr ) {
			player_struct.se = true; // sr edited mark
			break;
		}
	}
	
	// check if class order was edited
	var new_classes = [];
	for ( var i=0; i<class_rows.length; i++ ) {
		var class_row = class_rows[i];
		var class_title = class_row.getElementsByClassName("dlg-class-name")[0];
		var class_name = class_title.innerHTML;
		
		var class_checkbox = class_row.getElementsByClassName("dlg-class-enabled-checkbox")[0];
		if ( class_checkbox.checked ) {
			new_classes.push( class_name );
		}
	}
	for ( var i=0; i<new_classes.length; i++ ) {
		var old_index = player_struct.classes.indexOf( new_classes[i] );
		if ( old_index != i ) {
			player_struct.ce = true;
			break;
		}
	}
	for ( var i=0; i<player_struct.classes.length; i++ ) {
		var new_index = new_classes.indexOf( player_struct.classes[i] );
		if ( new_index != i ) {
			player_struct.ce = true;
			break;
		}
	}
	
	// save class order and sr to player
	player_struct.sr_by_class = {};
	player_struct.classes = [];
	for ( var i=0; i<class_rows.length; i++ ) {
		var class_row = class_rows[i];
		var class_title = class_row.getElementsByClassName("dlg-class-name")[0];
		var class_name = class_title.innerHTML;
		
		if ( class_names.indexOf(class_name) == -1 ) {
			continue;
		}
		
		var sr_edit = class_row.getElementsByClassName("dlg-sr-by-class")[0];
		var new_sr = Number(sr_edit.value);
		
		player_struct.sr_by_class[class_name] = new_sr;
		
		var class_checkbox = class_row.getElementsByClassName("dlg-class-enabled-checkbox")[0];
		if ( class_checkbox.checked && (new_sr > 0) ) {
			player_struct.classes.push( class_name );
		}
	}
	
	// pinned mark
	if ( document.getElementById("dlg_player_pinned").checked ) {
		pinned_players.add( player_struct.id );
	} else {
		pinned_players.delete( player_struct.id );
	}
	save_pinned_list();
	
	// check-in
	if ( document.getElementById("dlg_player_checkin").checked ) {
		checkin_list.add( player_struct.id );		
	} else {
		checkin_list.delete( player_struct.id );
	}
	save_checkin_list();
	
	close_dialog("popup_dlg_edit_player");
	save_players_list();
	redraw_player( player_struct );
	
	player_being_edited = undefined;
}

function enable_roll_debug() {
	var dbg_level = prompt("Debug level", 0);

	if (dbg_level === null) {
		return;
	}
	var dbg_level = Number(dbg_level);
	if( Number.isNaN(dbg_level) ) {
		return;
	}
	if( ! Number.isInteger(dbg_level) ) {
		return;
	}	
	
	document.getElementById("debug_log").innerHTML = "roll debug enabled, level "+dbg_level+"<br/>";
	
	balancer_settings = {
		roll_debug: true,	
		debug_level: dbg_level,
	};
	
	BalanceWorker.postMessage(["settings", balancer_settings]);
}

function export_lobby_dlg_open() {
	open_dialog("popup_dlg_export_lobby");
	export_lobby_dlg_change_format();
}

function export_lobby_dlg_change_format() {
	var format = document.getElementById("dlg_lobby_export_format_value").value;
	var export_str = export_lobby( format );
	document.getElementById("dlg_textarea_export_lobby").value = export_str;
	document.getElementById("dlg_textarea_export_lobby").select();
	document.getElementById("dlg_textarea_export_lobby").focus();
}

function export_teams_dlg_copy_html() {
	select_html( document.getElementById("dlg_html_export_teams") );
	document.execCommand("copy");
}

function export_teams_dlg_change_format() {
	// @ToDo save format and options
	var format = document.getElementById("dlg_team_export_format_value").value;
	var include_players = true;
	var include_sr = document.getElementById("dlg_team_export_sr").checked;
	var include_classes = document.getElementById("dlg_team_export_classes").checked;
	var include_captains = false;
	var table_columns = 2;
	
	// save format
	ExportOptions.format = format;
	ExportOptions.include_sr = include_sr;
	ExportOptions.include_classes = include_classes;
	localStorage.setItem( storage_prefix+"export_options", JSON.stringify(ExportOptions) );
	
	var export_str = export_teams( format, include_players, include_sr, include_classes, include_captains, table_columns );
	
	if ( format == "html-table" ) {
		var html_container = document.getElementById("dlg_html_export_teams");
		html_container.style.display = "";
		document.getElementById("dlg_html_export_teams_hint").style.display = "";
		document.getElementById("dlg_textarea_export_teams").style.display = "none";
		html_container.innerHTML = export_str;

		select_html( html_container );
	} else if ( format == "text-list" ) {
		document.getElementById("dlg_html_export_teams").style.display = "none";
		document.getElementById("dlg_html_export_teams_hint").style.display = "none";
		document.getElementById("dlg_textarea_export_teams").style.display = "";
		document.getElementById("dlg_textarea_export_teams").value = export_str;
		document.getElementById("dlg_textarea_export_teams").select();
		document.getElementById("dlg_textarea_export_teams").focus();
	} else if ( format == "image" ) {
		var html_container = document.getElementById("dlg_html_export_teams");
		html_container.innerHTML = "";
		html_container.style.display = "";
		document.getElementById("dlg_html_export_teams_hint").style.display = "none";
		document.getElementById("dlg_textarea_export_teams").style.display = "none";
		
		// convert html to image
				
		// calculate image size
		var tmp_div = document.createElement("div");
		tmp_div.style.position = "absolute";
		tmp_div.style.visibility = "hidden";
		tmp_div.innerHTML = export_str;
		document.body.appendChild(tmp_div);
		var img_width = tmp_div.firstChild.clientWidth;
		var img_height = tmp_div.firstChild.clientHeight;
		document.body.removeChild(tmp_div);

		var data = '<svg xmlns="http://www.w3.org/2000/svg" width="'+img_width+'" height="'+img_height+'">' +
				   '<foreignObject width="100%" height="100%">' +
				   '<div xmlns="http://www.w3.org/1999/xhtml" >' +
					 export_str +
				   '</div>' +
				   '</foreignObject>' +
				   '</svg>';
			
		data = encodeURIComponent(data);
		
		var canvas = document.createElement('canvas');
		canvas.width = img_width;
		canvas.height = img_height;
		var ctx = canvas.getContext('2d');
		
		var svg_img = new Image();

		svg_img.onload = function() {
			ctx.drawImage(svg_img, 0, 0);

			canvas.toBlob(function(blob) {
				var newImg = document.createElement('img'),
				url = URL.createObjectURL(blob);

				newImg.onload = function() { URL.revokeObjectURL(url); 	};

				newImg.src = url;
				html_container.appendChild(newImg);
			});
		}

		svg_img.src = "data:image/svg+xml," + data;
	}
}

function export_teams_dlg_open() {
	open_dialog("popup_dlg_export_teams");
	
	document.getElementById("dlg_team_export_format_value").value = ExportOptions.format;
	document.getElementById("dlg_team_export_sr").checked = ExportOptions.include_sr;
	document.getElementById("dlg_team_export_classes").checked = ExportOptions.include_classes;

	export_teams_dlg_change_format();
}

function fill_teams() {
	if ( is_role_lock_enabled() ) {
		for ( var team_slots of [team1_slots, team2_slots] ) {
			for ( var class_name in team_slots ) {
				var free_slots = Settings.slots_count[class_name] - team_slots[class_name].length;
				var available_players = [];
				
				// first pass - pick players by main role for slot
				for ( var player of lobby ) {
					if ( checkin_list.size > 0 ) {
						if ( ! checkin_list.has(player.id) ) {
							continue;
						}
					}
					if ( player.classes[0] !== class_name ) {
						continue;
					}
					available_players.push( player );
				}
				
				while ( (free_slots > 0) && (available_players.length > 0) ) {
					var random_index = Math.floor(Math.random() * available_players.length);
					var random_player = available_players[ random_index ];
					lobby.splice( lobby.indexOf(random_player), 1 );
					available_players.splice( available_players.indexOf(random_player), 1 );
					team_slots[class_name].push( random_player );
					free_slots--;
				}
				if ( free_slots <= 0 ) {
					continue;
				}
				
				// second pass - pick players able to play specified role
				for ( var player of lobby ) {
					if ( checkin_list.size > 0 ) {
						if ( ! checkin_list.has(player.id) ) {
							continue;
						}
					}
					if ( player.classes.indexOf(class_name) == -1 ) {
						continue;
					}
					available_players.push( player );
				}
				while ( (free_slots > 0) && (available_players.length > 0) ) {
					var random_index = Math.floor(Math.random() * available_players.length);
					var random_player = available_players[ random_index ];
					lobby.splice( lobby.indexOf(random_player), 1 );
					available_players.splice( available_players.indexOf(random_player), 1 );
					team_slots[class_name].push( random_player );
					free_slots--;
				}
				if ( free_slots <= 0 ) {
					continue;
				}
				
				// third pass - pick any available players
				for ( var player of lobby ) {
					if ( checkin_list.size > 0 ) {
						if ( ! checkin_list.has(player.id) ) {
							continue;
						}
					}
					available_players.push( player );
				}
				while ( (free_slots > 0) && (available_players.length > 0) ) {
					var random_index = Math.floor(Math.random() * available_players.length);
					var random_player = available_players[ random_index ];
					lobby.splice( lobby.indexOf(random_player), 1 );
					available_players.splice( available_players.indexOf(random_player), 1 );
					team_slots[class_name].push( random_player );
					free_slots--;
				}
			}
		}
	} else {
		for ( var team of [team1, team2] ) {
			var free_slots = get_team_size() - team.length;
			var available_players = [];
			for ( var player of lobby ) {
				if ( checkin_list.size > 0 ) {
					if ( checkin_list.has(player.id) ) {
						available_players.push( player );
					}
				} else {
					available_players.push( player );
				}
			}
			
			while ( (free_slots > 0) && (available_players.length > 0) ) {
				var random_index = Math.floor(Math.random() * available_players.length);
				var random_player = available_players[ random_index ];
				lobby.splice( lobby.indexOf(random_player), 1 );
				available_players.splice( available_players.indexOf(random_player), 1 );
				team.push( random_player );
				free_slots--;
			}
		}
	}
	
	save_players_list();
	redraw_lobby();
	redraw_teams();
}

function generate_random_players() {
	var number_to_add_str = prompt("Enter number of players to generate", 1);

	if (number_to_add_str === null) {
		return;
	}
	var number_to_add = Number(number_to_add_str);
	if( Number.isNaN(number_to_add) ) {
		return;
	}
	if( ! Number.isInteger(number_to_add) ) {
		return;
	}
	
	if( number_to_add > 10000 ) {
		return;
	}

	for( var i=1; i<=number_to_add; i++ ) {
		var new_player = create_random_player(i);
		lobby.push( new_player );
	}

	save_players_list();
	redraw_lobby();
}

function import_lobby_dlg_open() {
	open_dialog("popup_dlg_import_lobby");
	document.getElementById("dlg_textarea_import_lobby").value = "";
	document.getElementById("dlg_textarea_import_lobby").focus();
}

function import_lobby_ok() {
	var format = document.getElementById("dlg_player_import_format_value").value;
	var import_str = document.getElementById("dlg_textarea_import_lobby").value;
	if ( import_lobby(format, import_str) ) {
		close_dialog("popup_dlg_import_lobby");
	}
}

function lobby_filter_clear() {
	document.getElementById("lobby_filter").value="";
	apply_lobby_filter();
}

function manual_checkin_open() {
	open_dialog("popup_dlg_manual_checkin");
	
	// fill players table
	var tbody = document.getElementById("manual_checkin_table").tBodies[0];
	var thead = document.getElementById("manual_checkin_table").tHead;
	var tfoot = document.getElementById("manual_checkin_table").tFoot;
	
	tbody.innerHTML = "";
	for (var i=0; i<lobby.length; i++) {
		var row = document.createElement("tr");
		row.onclick = manual_checkin_row_click;
		
		var cell = document.createElement("td");
		var cbox = document.createElement("input");
		cbox.type = "checkbox";
		cbox.setAttribute("player_id", lobby[i].id);
		cbox.onchange = manual_checkin_checkbox_change;
		cbox.autocomplete = "off";
		if ( checkin_list.has(lobby[i].id) ) {
			cbox.checked = true;
			row.classList.add("checked");
		}
		cell.appendChild(cbox);
		row.appendChild(cell);
		
		cell = document.createElement("td");
		var cellText = document.createTextNode( format_player_id(lobby[i].id) );
		cell.appendChild(cellText);
		row.appendChild(cell);
		
		tbody.appendChild(row);
	}

	// reset sorting marks
	for ( var i=0; i<thead.rows[0].cells.length; i++ ) {
		thead.rows[0].cells[i].removeAttribute("order_inverse");
	}
	sort_manual_chekin_table( 1 );
	
	tfoot.getElementsByTagName("td")[0].innerHTML = checkin_list.size;
	tfoot.getElementsByTagName("td")[1].innerHTML = lobby.length;
}

function move_team_to_lobby(team, team_slots) {
	lobby = lobby.concat( team.filter((player,index,arr)=>{
		return ! pinned_players.has(player.id)
	}) );
	var filtered = team.filter((player,index,arr)=>{
		return pinned_players.has(player.id)
	});
	team.splice( 0, team.length );
	while ( filtered.length > 0 ) {
		let removed_player = filtered.pop();
		team.push( removed_player );
	}
	
	for ( let class_name in team_slots ) {
		lobby = lobby.concat( team_slots[class_name].filter((player,index,arr)=>{
			return ! pinned_players.has(player.id)
		}) );
		team_slots[class_name] = team_slots[class_name].filter((player,index,arr)=>{
			return pinned_players.has(player.id)
		});
	}
	
	//update_captains();
	save_players_list();
	redraw_lobby();
	redraw_teams();
}

function open_stats_update_log() {
	open_dialog("popup_dlg_stats_log");
}

function player_class_row_movedown(ev) {
	var current_row = get_parent_element( ev.currentTarget, "TR" );
	
	var rows = document.getElementById("dlg_player_class_table").rows;
	var row_index = current_row.rowIndex;
	if ( row_index == (rows.length-1) ) {
		return;
	}
	
	rows[row_index].parentNode.insertBefore(rows[row_index + 1], rows[row_index]);
}

function player_class_row_moveup(ev) {
	var current_row = get_parent_element( ev.currentTarget, "TR" );
	
	var rows = document.getElementById("dlg_player_class_table").rows;
	var row_index = current_row.rowIndex;
	if ( row_index == 0 ) {
		return;
	}
	
	rows[row_index].parentNode.insertBefore(rows[row_index], rows[row_index - 1]);
}

function reset_checkin() {
	if( ! confirm("Clear all check-in marks?") ) {
		return;
	}
	
	checkin_list.clear();
	save_checkin_list();
	redraw_lobby();
}

function reset_settings() {
	fill_settings_dlg( get_default_settings() );
}

function role_lock_changed() {
	localStorage.setItem(storage_prefix+"role_lock_enabled", document.getElementById("role_lock_enabled").checked );
	
	// move all players from slots to arrays	
	for( let class_name of class_names ) {
		if ( team1_slots[class_name] == undefined ) {
			continue;
		}
		while ( team1_slots[class_name].length > 0 ) {
			let removed_player = team1_slots[class_name].shift();
			team1.push( removed_player );
		}
	}
	for( let class_name of class_names ) {
		if ( team2_slots[class_name] == undefined ) {
			continue;
		}
		while ( team2_slots[class_name].length > 0 ) {
			let removed_player = team2_slots[class_name].shift();
			team2.push( removed_player );
		}
	}
	
	// if using role lock - move from array to slots in order
	if ( document.getElementById("role_lock_enabled").checked ) {
		init_team_slots( team1_slots );
		for( let class_name of class_names ) {
			for(var i=0; i<Settings["slots_count"][class_name]; i++) {
				let removed_player = team1.shift();
				if (removed_player == undefined ) {
					break;
				}
				team1_slots[class_name].push( removed_player );
			}
		}
		
		init_team_slots( team2_slots );
		for( let class_name of class_names ) {
			for(var i=0; i<Settings["slots_count"][class_name]; i++) {
				let removed_player = team2.shift();
				if (removed_player == undefined ) {
					break;
				}
				team2_slots[class_name].push( removed_player );
			}
		}
	}
	
	redraw_teams();
}

function settings_dlg_open() {
	fill_settings_dlg( Settings );
	open_dialog( "popup_dlg_settings" );
}

function shuffle_lobby() {
	lobby = array_shuffle( lobby );
	save_players_list();
	redraw_lobby();
}

function sort_lobby( sort_field = 'sr', button_element=undefined ) {
	var order_inverse = false;
	if (button_element !== undefined) {
		if (button_element.hasAttribute("order_inverse")) {
			order_inverse = true;
			button_element.removeAttribute("order_inverse");
		} else {
			button_element.setAttribute("order_inverse", "");
		}
	}
	sort_players(lobby, sort_field, order_inverse);
	save_players_list();
	redraw_lobby();
}

function sort_manual_chekin_table( sort_column_index ) {
	var tbody = document.getElementById("manual_checkin_table").tBodies[0];
	var thead = document.getElementById("manual_checkin_table").tHead;
	var header_cell = thead.rows[0].cells[sort_column_index];
	
	var order = 1;
	if (header_cell.hasAttribute("order_inverse")) {
		order = -1;
		header_cell.removeAttribute("order_inverse");
	} else {
		header_cell.setAttribute("order_inverse", "");
	}
	
	// create temporary array of table rows and sort it in memory
	// avoiding expensive DOM updates
	var temp_rows = [];
	for (var i = 0; i < tbody.rows.length; i++) {
		temp_rows.push(tbody.rows[i]);
	}
	
	temp_rows.sort( function(row1, row2){
			if ( sort_column_index == 0 ) {
				var this_row_calue = row1.cells[sort_column_index].getElementsByTagName("input")[0].checked;
				var next_row_calue = row2.cells[sort_column_index].getElementsByTagName("input")[0].checked;
			} else {
				var this_row_calue = row1.cells[sort_column_index].innerText.toLowerCase();
				var next_row_calue = row2.cells[sort_column_index].innerText.toLowerCase();
			}
			
			// convert to number if possible
			if ( is_number_string(this_row_calue) ) {
				this_row_calue = Number(this_row_calue);
			}
			if ( is_number_string(next_row_calue) ) {
				next_row_calue = Number(next_row_calue);
			}
			
			return order * ( this_row_calue<next_row_calue ? -1 : (this_row_calue>next_row_calue?1:0) );
			} 
		);
	
	// rearrange table rows in DOM according to sorted array
	for (var i = temp_rows.length-1; i >= 0; i--) {
		temp_rows[i].parentNode.insertBefore(temp_rows[i], temp_rows[i].parentNode.firstChild);
	}
	
	// draw arrow on this column header
	for(var i=0; i<thead.rows[0].cells.length; i++) {
		thead.rows[0].cells[i].classList.remove("sort-up");
		thead.rows[0].cells[i].classList.remove("sort-down");
	}
	
	if ( order > 0 ) {
		thead.rows[0].cells[sort_column_index].classList.add("sort-up");
	} else {
		thead.rows[0].cells[sort_column_index].classList.add("sort-down");
	}
}

function sort_team( team, sort_field = 'sr' ) {
	sort_players( team, sort_field );
}


function stop_stats_update() {
	StatsUpdater.stop( true );
}

function test() {
	//----------------
	
	/*start_time = performance.now();
	var class_mask = Array( 12 ).fill(0);
	var all_class_combinations = 0;	
	while ( Balancer.incrementClassMask( class_mask ) ) {
		all_class_combinations ++;		
		//document.getElementById("debug_log").innerHTML += JSON.stringify(class_mask)+"<br/>";
	}
	document.getElementById("debug_log").innerHTML += "<br/>";
	document.getElementById("debug_log").innerHTML += "total class combination = "+all_class_combinations;
		document.getElementById("debug_log").innerHTML += "<br/>";
	execTime = performance.now() - start_time;
	document.getElementById("debug_log").innerHTML += "exec time = "+execTime;*/
	
	document.getElementById("debug_log").innerHTML += JSON.stringify( Array.from(pinned_players) ) + "<br/>";
}

function update_active_stats() {
	open_dialog("popup_dlg_stats_update_init");
	document.getElementById("dlg_stats_update_ok").onclick = update_stats_ok.bind( this, "active" );
	on_stats_update_limit_change();
}


function update_all_stats() {
	open_dialog("popup_dlg_stats_update_init");
	document.getElementById("dlg_stats_update_ok").onclick = update_stats_ok.bind( this, "all" );
	on_stats_update_limit_change();
}

function update_current_player_stats() {
	// forcing update of manually edited fields
	delete player_being_edited.se;
	delete player_being_edited.ce;
	
	StatsUpdater.addToQueue( player_being_edited, 0, true );
	
	document.getElementById("dlg_update_player_stats_loader").style.display = "";
	document.getElementById("dlg_edit_player_update_result").style.display = "none";
	document.getElementById("dlg_edit_player_update_result").innerHTML = "";
}

function update_stats_ok( scope ) {
	close_dialog("popup_dlg_stats_update_init");
	
	// pass date limit to updater
	var raw_value = Number(document.getElementById("stats_update_limit").value);
	var stats_max_age = convert_range_log_scale( raw_value, 1, 3000 ) - 1;
	
	switch ( scope ) {
		case "all":
			StatsUpdater.addToQueue( lobby, stats_max_age );
			// break not needed here ;)
		case "active":
			StatsUpdater.addToQueue( team1, stats_max_age );
			StatsUpdater.addToQueue( team2, stats_max_age );
			for( class_name in team1_slots) {
				StatsUpdater.addToQueue( team1_slots[class_name], stats_max_age );
			}
			for( class_name in team2_slots) {
				StatsUpdater.addToQueue( team2_slots[class_name], stats_max_age );
			}
			break;
	}
}

/*
*		UI events
*/

function adjust_sr_change() {
	var adjust_enabled = document.getElementById("adjust_sr").checked;
	var inputs = document.getElementById("adjust_sr_sub").getElementsByTagName("INPUT");
	for (var i=0; i<inputs.length; i++ ) {
		inputs[i].disabled = ! adjust_enabled;
	}
}

function manual_checkin_checkbox_change(ev){
	var cbox = ev.target;
	var tr = cbox.parentNode.parentNode;
	
	manual_checkin_toggle_player( tr, cbox );
}

function manual_checkin_row_click(ev) {
	var tr = ev.currentTarget;
	var cbox = tr.cells[0].getElementsByTagName("input")[0];
	
	if (ev.target.tagName.toLowerCase() != "input") {
		cbox.checked = ! cbox.checked;
	}
	
	manual_checkin_toggle_player( tr, cbox );
}

function manual_checkin_toggle_player( tr, cbox ) {
	var player_id = cbox.getAttribute("player_id");
	if ( cbox.checked ) {			
		checkin_list.add(player_id);
		save_checkin_list();
		tr.classList.toggle("checked", true);
	} else {
		checkin_list.delete(player_id);
		save_checkin_list();
		tr.classList.toggle("checked", false);
	}
	
	document.getElementById("manual_checkin_table").tFoot.getElementsByTagName("td")[0].innerHTML = checkin_list.size;
}

function on_lobby_filter_change() {
	clearTimeout( lobby_filter_timer );
	lobby_filter_timer = setTimeout( apply_lobby_filter, 400 );
}

function on_player_class_sr_changed(ev) {
	var sr_edit = ev.currentTarget;
	var rank_name = get_rank_name( sr_edit.value );
	var sr_img = sr_edit.parentElement.getElementsByClassName("rank-icon-dlg")[0];	
	sr_img.src = "rank_icons/"+rank_name+"_small.png";
	sr_img.title = rank_name;
}

function on_player_edit_class_toggled(ev) {
	var class_checkbox = ev.currentTarget;
	var current_row = get_parent_element( class_checkbox, "TR" );
	
	if ( class_checkbox.checked ) {
		current_row.classList.remove("class-disabled");
	} else {
		current_row.classList.add("class-disabled");
	}
}

function on_stats_update_limit_change() {
	// convert from log scale
	var raw_value = Number(document.getElementById("stats_update_limit").value);
	var max_stats_age_days = convert_range_log_scale( raw_value, 1, 3000 ) - 1;
	document.getElementById("dlg_stats_update_days").innerHTML = max_stats_age_days;
	var max_stats_age_date = new Date(Date.now() - (max_stats_age_days*24*3600*1000));
	document.getElementById("dlg_stats_update_date").innerHTML = max_stats_age_date.toLocaleDateString();
}

function new_player_keyup(ev) {
	ev.preventDefault();
    if (ev.keyCode == 13) { //enter pressed
		if ( ! document.getElementById("add_btn").disabled ) {
			add_player_click();
		}
    }
}

function player_allowDrop(ev) {
    ev.preventDefault();
	ev.dataTransfer.dropEffect = "move";
}

function player_contextmenu(ev) {
	ev.preventDefault();
	
	var player_id = ev.currentTarget.id;
	player_being_edited = find_player_by_id(player_id);
	if( player_being_edited == undefined ) {
		alert("player not found!");
		return;
	}
	
	fill_player_stats_dlg();
	
	open_dialog("popup_dlg_edit_player");
}

function player_dblClick(ev) {
	var selected_id = ev.currentTarget.id;
	
	if (selected_id == "") {
		return;
	}

	// detect selected team
	var selected_team;
	var parent_id = ev.currentTarget.parentElement.parentElement.id;
	if (parent_id == "lobby") {
		selected_team = lobby;
	} else {
		for( let team of [team1, team2] ) {
			for( var i=0; i<team.length; i++) {
				if ( selected_id == team[i].id) {
					selected_team = team;
				}
			}
		}
		
		for ( let team_slots of [team1_slots, team2_slots] ) {
			for ( let class_name in team_slots ) {
				for( var i=0; i<team_slots[class_name].length; i++) {
					if ( selected_id == team_slots[class_name][i].id) {
						selected_team = team_slots[class_name];
					}
				}
			}
		}
	}
	
	// find index in team for player
	var selected_index = get_player_index( selected_id, selected_team );
	var selected_player = selected_team[selected_index];
	
	// detect target team
	var new_team;
	if (selected_team == lobby) {
		// find team with empty slot		
		new_team = find_team_with_free_slot( selected_player );
	} else {
		new_team = lobby;
	}
	// check if team has free slots
	if ( new_team === undefined ) {
		alert("Teams are full");
		return;
	}
	
	if (selected_team == lobby) {
		if ( Settings.update_picked ) {
			StatsUpdater.addToQueue( selected_player, Settings.update_picked_maxage, true );
		}
	}
	
	// move player
	new_team.push( selected_player );
	selected_team.splice(selected_index, 1);
	
	save_players_list();
	redraw_lobby();
	redraw_teams();
}

function player_drag(ev) {
	 ev.dataTransfer.setData("text/plain", ev.currentTarget.id);
	 ev.dataTransfer.effectAllowed = "move";
	 ev.dropEffect = "move";
}

function player_drop(ev) {
	ev.preventDefault();
	ev.stopPropagation();
	
    var dragged_id = ev.dataTransfer.getData("text");
	var target_id = ev.currentTarget.id;
	if (dragged_id == target_id) {
		return false;
	}
	
	var drag_action = "swap";
	
	if( target_id == "trashcan" ) {
		drag_action = "remove";
		target_id = "";
	}
	
	// find team and index in team for both players 
	var dragged_team;
	var dragged_index;
	var dragged_player;
	var target_team;
	var target_index;
	var target_player;
	
	for( var i=0; i<lobby.length; i++) {
		if ( dragged_id == lobby[i].id) {
			dragged_team = lobby;
			dragged_index = i;
			dragged_player = lobby[i];
		}
		if ( target_id == lobby[i].id) {
			target_team = lobby;
			target_index = i;
			target_player = lobby[i];
		}
	}
	for( let team of [team1, team2] ) {
		for( var i=0; i<team.length; i++) {
			if ( dragged_id == team[i].id) {
				dragged_team = team;
				dragged_index = i;
				dragged_player = team[i];
			}
			if ( target_id == team[i].id) {
				target_team = team;
				target_index = i;
				target_player = team[i];
			}
		}
	}
	
	// also search in role slots
	for ( let team_slots of [team1_slots, team2_slots] ) {
		for ( let class_name in team_slots ) {
			for( var i=0; i<team_slots[class_name].length; i++) {
				if ( dragged_id == team_slots[class_name][i].id) {
					dragged_team = team_slots[class_name];
					dragged_index = i;
					dragged_player = team_slots[class_name][i];
				}
				if ( target_id == team_slots[class_name][i].id) {
					target_team = team_slots[class_name];
					target_index = i;
					target_player = team_slots[class_name][i];
				}
			}
		}
	}
	
	if (target_id == "") {
		// dropped on empty slot
		var parent_id = ev.currentTarget.parentElement.parentElement.id;
		if (parent_id == "lobby") {
			target_team = lobby;
			target_index = lobby.length;
		} else if (parent_id == "team1") {
			// check if target item is role slot
			if ( ev.currentTarget.hasAttribute("slotClass") ) {
				target_team = team1_slots[ ev.currentTarget.getAttribute("slotClass") ];
				target_index = team1_slots[ ev.currentTarget.getAttribute("slotClass") ].length;
			} else {
				target_team = team1;
				target_index = team1.length;
			}
		} else if (parent_id == "team2") {
			// check if target item is role slot
			if ( ev.currentTarget.hasAttribute("slotClass") ) {
				target_team = team2_slots[ ev.currentTarget.getAttribute("slotClass") ];
				target_index = team2_slots[ ev.currentTarget.getAttribute("slotClass") ].length;
			} else {
				target_team = team2;
				target_index = team2.length;
			}
		}
		
		if ( dragged_team == target_team ) {
			// just move to end within team
			target_index = target_team.length - 1;
		}
	}
	
	if ((target_team == lobby) && (dragged_team != lobby)) {
		drag_action = "move"; 
	}
	
	if (drag_action == "move") {
		// move dragged player to target team (lobby)
		target_team.splice(target_index, 0, dragged_player);
		dragged_team.splice(dragged_index, 1);
	} else {
		if (target_id == "") {
			// remove dragged player from source team
			dragged_team.splice(dragged_index, 1);
		} else {
			// replace dragged player with target
			dragged_team[dragged_index] = target_player;
		}
	}
	
	if (drag_action == "swap") {
		// replace target with dragged player
		target_team[target_index] = dragged_player;
	}
	
	if (drag_action == "remove") {
		// remove from update queue
		StatsUpdater.removeFromQueue(dragged_id);
		// remove from pinned
		pinned_players.delete(dragged_id);
		save_pinned_list();
		// remove from checkin
		checkin_list.delete(dragged_id);
		save_checkin_list();
	}
	
	if ((target_team != lobby) && (dragged_team == lobby) && (drag_action != "remove")) {
		if ( Settings.update_picked ) {
			StatsUpdater.addToQueue( dragged_player, Settings.update_picked_maxage, true );
		}
	}
	
	save_players_list();
	redraw_lobby();
	redraw_teams();
}

function save_team_name( element ) {
	localStorage.setItem( storage_prefix+element.id, element.value );
}

/*
*		Other events
*/

function on_balance_worker_message(e) {
	if ( ! Array.isArray(e.data) ) {
		return;
	}
	if ( e.data.length == 0 ) {
		return;
	}
	
	var event_type = e.data[0];
	if ( event_type == "progress" ) {
		if (e.data.length < 2) {
			return;
		}
		var progress_struct = e.data[1];
		document.getElementById("dlg_progress_bar").value = progress_struct.current_progress;
		document.getElementById("dlg_progress_text").innerHTML = progress_struct.current_progress.toString() + " %";
	} else if ( event_type == "finish" ) {
		if (e.data.length < 2) {
			return;
		}
		var result_struct = e.data[1];
		
		if ( result_struct.is_successfull ) {
			document.getElementById("role_lock_enabled").checked = result_struct.is_rolelock;
			localStorage.setItem(storage_prefix+"role_lock_enabled", result_struct.is_rolelock );
			
			// copy references to players from balancer to global teams
			team1 = result_struct.team1.slice();
			team2 = result_struct.team2.slice();
			init_team_slots( team1_slots );
			for( let class_name in result_struct.team1_slots ) {
				team1_slots[class_name] = result_struct.team1_slots[class_name].slice();
			}
			init_team_slots( team2_slots );
			for( let class_name in result_struct.team2_slots ) {
				team2_slots[class_name] = result_struct.team2_slots[class_name].slice();
			}
			
			sort_players( team1, 'sr' );
			sort_players( team2, 'sr' );
			
			redraw_teams();
			
			// hide dialog
			close_dialog("popup_dlg_progress");
		} else {
			document.getElementById("dlg_progress_text").innerHTML = "Balance not found";
			document.getElementById("dlg_progress_cancel").style.display = "none";
			document.getElementById("dlg_progress_close").style.display = "";
		}
	} else if ( event_type == "error" ) {
		if (e.data.length < 2) {
			return;
		}
		alert("Balancer error: "+e.data[1]);
	} else if ( event_type == "dbg" ) {
		if (e.data.length < 2) {
			return;
		}
		
		var dbg_msg = e.data[1];
		document.getElementById("debug_log").innerHTML += dbg_msg+"</br>";
	}
}

function on_player_stats_updated( player_id ) {
	if ( player_being_added !== undefined ) {
		if ( player_id == player_being_added.id ) {
			// add new player to team with empty slots or lobby
			var target_team = find_team_with_free_slot( player_being_added );
			if ( target_team == undefined ) {
				target_team = lobby;
			}

			target_team.push( player_being_added );
			save_players_list();
			redraw_lobby();
			redraw_teams();
			highlight_player( player_id );
			setTimeout( function() {document.getElementById(player_id).scrollIntoView(false);}, 100 );
			document.getElementById("new_player_id").value = "";
			document.getElementById("add_btn").disabled = false;
			
			player_being_added = undefined;
		}
	} else {
		if ( player_being_edited !== undefined  ) {
			if ( player_id == player_being_edited.id ) {
				// redraw edit dialog
				fill_player_stats_dlg(false);
				
				// hide loader
				document.getElementById("dlg_update_player_stats_loader").style.display = "none";
			}
		}
		
		// find and redraw player
		var player_struct = find_player_by_id( player_id );
		if ( player_struct !== undefined ) {
			redraw_player( player_struct );
			highlight_player( player_id );
			save_players_list();
		}
	}
}

function on_stats_update_complete() {
	document.getElementById("stats_updater_status").innerHTML = "Update complete";
	setTimeout( draw_stats_updater_status, StatsUpdater.min_api_request_interval );
	
	document.getElementById("update_stats_stop_btn").style.visibility = "hidden";
	document.getElementById("stats_update_progress").style.visibility = "hidden";
}

function on_stats_update_error( player_id, error_msg, is_changed ) {
	log_stats_update_error( player_id+": "+error_msg );
	
	if ( player_being_added !== undefined ) {
		if ( player_being_added.id == player_id ) {
			if( confirm("Can't get player stats: "+error_msg+"\nAdd manually?") ) {
				var new_player = create_empty_player();
				new_player.id = player_id;
				new_player.display_name = format_player_name( player_id );
				delete new_player.empty;
				
				// add new player to team with empty slots or lobby
				var target_team = find_team_with_free_slot( new_player );
				if ( target_team == undefined ) {
					target_team = lobby;
				}				
				target_team.push( new_player );
				save_players_list();
				redraw_lobby();
				redraw_teams();
				highlight_player( player_id );
				setTimeout( function() {document.getElementById(player_id).scrollIntoView(false);}, 100 );
				document.getElementById("new_player_id").value = "";				
				
				// open edit dialog
				player_being_edited = new_player;
				fill_player_stats_dlg();
				open_dialog("popup_dlg_edit_player");
			}
			
			document.getElementById("add_btn").disabled = false;
			
			// release created object for garbage collector
			player_being_added = undefined;
		}
	}
	
	if ( player_being_edited !== undefined  ) {
		if ( player_id == player_being_edited.id ) {
			// hide loader, show message
			document.getElementById("dlg_update_player_stats_loader").style.display = "none";
			document.getElementById("dlg_edit_player_update_result").style.display = "";
			document.getElementById("dlg_edit_player_update_result").innerHTML = escapeHtml( error_msg );
			
			if ( is_changed ) { 
				if ( player_struct.private_profile === true ) {
					document.getElementById("dlg_player_private_profile").style.display = "inline";
				} else {
					document.getElementById("dlg_player_private_profile").style.display = "none";
				}
			}
		}
	}
	
	if ( is_changed ) {
		save_players_list();
	}
}

function on_stats_update_warning( player_id, error_msg ) {
	log_stats_update_error( player_id+": "+error_msg );
	
	if ( player_being_edited !== undefined  ) {
		if ( player_id == player_being_edited.id ) {
			document.getElementById("dlg_edit_player_update_result").style.display = "";
			document.getElementById("dlg_edit_player_update_result").innerHTML += escapeHtml( error_msg );
		}
	}
}

function on_stats_update_progress() {
	draw_stats_updater_status();
}

function on_stats_update_start() {
	document.getElementById("update_stats_stop_btn").style.visibility = "visible";
	document.getElementById("stats_update_progress").style.visibility = "visible";
	draw_stats_updater_status();
}

/*
*		Common UI functions
*/

function apply_lobby_filter() {
	var filter_value = document.getElementById("lobby_filter").value.toLowerCase();
	if (filter_value != "") {
		document.getElementById("lobby_filter").classList.add("filter-active");
	} else {
		document.getElementById("lobby_filter").classList.remove("filter-active");
	}
	
	for( var i=0; i<lobby.length; i++) {
		if ( filter_value == "" || lobby[i].display_name.toLowerCase().includes( filter_value ) || lobby[i].id.toLowerCase().includes( filter_value ) ) {
			document.getElementById(lobby[i].id).parentElement.style.display = "table-row";
		} else {
			document.getElementById(lobby[i].id).parentElement.style.display = "none";
		}
	}
}

function convert_range_log_scale( raw_value, out_min, out_max, precision=0, input_range=100 ) {
	return round_to( Math.pow( 2, Math.log2(out_min)+(Math.log2(out_max)-Math.log2(out_min))*raw_value/input_range ), precision );
}

function draw_player( player_struct, small=false, is_captain=false, slot_class=undefined ) {
	var new_player_item_row = document.createElement("div");
	new_player_item_row.className = "row";
	
	if ( slot_class != undefined ) {
		var class_cell = document.createElement("div");
		class_cell.className = "cell class-cell";
		
		var class_icon = document.createElement("img");
		class_icon.className = "class-icon-slot";
		class_icon.src = "class_icons/"+slot_class+".png";
		class_icon.title = slot_class;
		class_cell.appendChild(class_icon);
		
		new_player_item_row.appendChild(class_cell);
	}
	
	var new_player_cell = draw_player_cell( player_struct, small, is_captain, slot_class );
	new_player_item_row.appendChild(new_player_cell);
	
	return new_player_item_row;
}

function draw_player_cell( player_struct, small=false, is_captain=false, slot_class=undefined ) {
	var text_node;
	var br_node;
	
	var new_player_item = document.createElement("div");
	new_player_item.className = "cell player-item";
	if( player_struct.empty ) {
			new_player_item.classList.add("empty-player");
	}
	new_player_item.id = player_struct.id;
	if( ! player_struct.empty) {
		new_player_item.title = player_struct.id;
		new_player_item.title += "\nLevel: " + player_struct.level;
		for( let class_name of player_struct.classes ) {
			new_player_item.title += "\n"+class_name+": "+is_undefined(player_struct.sr_by_class[class_name],0)+" sr";
		}
		new_player_item.title += "\nLast updated: " + print_date(player_struct.last_updated);
		if ( is_captain ) {
			new_player_item.title += "\nTeam captain";
		}
		if ( Array.isArray(player_struct.top_heroes) ) {
			new_player_item.title += "\nTop heroes: ";
			for( i=0; i<player_struct.top_heroes.length; i++ ) {
				new_player_item.title += player_struct.top_heroes[i].hero;
				if ( i< player_struct.top_heroes.length-1) {
					new_player_item.title += ", ";
				}
			}
		}
	}
	
	if( ! player_struct.empty) {
		new_player_item.draggable = true;
	}
	new_player_item.ondragstart = function(event){player_drag(event);};
	new_player_item.ondrop = function(event){player_drop(event);};
	new_player_item.ondragover = function(event){player_allowDrop(event);};
	new_player_item.ondblclick = function(event){player_dblClick(event);};
	new_player_item.oncontextmenu = function(event){player_contextmenu(event);};
	
	if( slot_class != undefined ) {
		new_player_item.setAttribute( "slotClass", slot_class );
	}
	
	// rank icon
	var player_icon = document.createElement("div");
	player_icon.className = "player-icon";
		
	var icon_image = document.createElement("div");
	icon_image.className = "icon-image";
	
	var img_node = document.createElement("img");
	img_node.className = "rank-icon";
	
	var sr_calc_method = Settings["sr_calc_method"];
	if( slot_class != undefined ) {
		sr_calc_method = slot_class;
	}
	var player_sr = get_player_sr( player_struct, sr_calc_method );
	var rank_name = get_rank_name( player_sr );
	img_node.src = "rank_icons/"+rank_name+"_small.png";
	img_node.title = rank_name;
	icon_image.appendChild(img_node);
	player_icon.appendChild(icon_image);
	
	// SR value
	br_node = document.createElement("br");
	player_icon.appendChild(br_node);

	var icon_sr = document.createElement("div");
	icon_sr.className = "icon-sr";

	var sr_display = document.createElement("span");
	sr_display.id = "sr_display_"+player_struct.id;
	var sr_text = player_sr;
	if( player_struct.empty ) {
		sr_text = '\u00A0';
	}
	text_node = document.createTextNode( sr_text );
	sr_display.appendChild(text_node);
	if( player_struct.se === true ) {
		sr_display.classList.add("sr-edited");
	}
	icon_sr.appendChild(sr_display);

	player_icon.appendChild(icon_sr);

	
	new_player_item.appendChild(player_icon);
	
	// space after rank icon
	text_node = document.createTextNode("\u00A0");
	new_player_item.appendChild(text_node)
	
	// player name
	var player_name = document.createElement("div");
	player_name.className = "player-name";
		
	var name_display = document.createElement("span");
	name_display.id = "name_display_"+player_struct.id;
	var display_name = player_struct.display_name;
	if ( display_name == "" ) {
		display_name = "\u00A0"; // nbsp
	}
	text_node = document.createTextNode( display_name );
	name_display.appendChild(text_node);
	player_name.appendChild(name_display);
	
	// captain mark
	if ( is_captain ) {
		var captain_icon = document.createElement("span");
		captain_icon.className = "captain-mark";
		captain_icon.title = "team captain";
		text_node = document.createTextNode( " \u265B" );
		captain_icon.appendChild(text_node);
		player_name.appendChild(captain_icon);
	}
	
	new_player_item.appendChild(player_name);
	
	// check-in mark
	if ( (!small) && (checkin_list.has(player_struct.id)) ) {
		var mark_display = document.createElement("span");
		mark_display.className = "player-checkin-mark";
		mark_display.title = "Checked-in";
		text_node = document.createTextNode( "\u2713" );
		mark_display.appendChild(text_node);
		player_name.appendChild(mark_display);
	}
	
	// active classes icons
	if ( player_struct.classes !== undefined ) {
		for(var i=0; i<player_struct.classes.length; i++) {
			var class_icon = document.createElement("img");
			class_icon.className = "class-icon";
			if( i != 0 )  {
				class_icon.classList.add("secondary-class");
			}
			if( player_struct.ce === true ) {
				class_icon.classList.add("class-edited");
			}
			class_icon.src = "class_icons/"+player_struct.classes[i]+".png";
			class_icon.title = player_struct.classes[i] + " " + is_undefined(player_struct.sr_by_class[player_struct.classes[i]],0) + " SR";
			new_player_item.appendChild(class_icon);
		}
	}
	
	// pinned mark
	if ( pinned_players.has(player_struct.id) ) {
		var pinned_icon = document.createElement("img");
		pinned_icon.className = "pinned-icon";
		pinned_icon.title = "pinned";		
		pinned_icon.src = "img/pinned.png";
		player_name.appendChild(pinned_icon);
	}
	
	return new_player_item;
}

function draw_stats_updater_status() {
	var updater_status_txt = "";
	if ( StatsUpdater.state == StatsUpdaterState.updating ) {
		updater_status_txt += "Updating stats <br/>"+ StatsUpdater.currentIndex + " / " + StatsUpdater.totalQueueLength;
		updater_status_txt += " "+StatsUpdater.current_id;
	}
	document.getElementById("stats_updater_status").innerHTML = updater_status_txt;
	
	document.getElementById("stats_update_progress").value = StatsUpdater.currentIndex;
	document.getElementById("stats_update_progress").max = StatsUpdater.totalQueueLength;
}

function fill_player_stats_dlg( clear_errors=true ) {
	if (player_being_edited === undefined) {
		return;
	}
	
	var player_struct = player_being_edited;
	
	document.getElementById("dlg_title_edit_player").innerHTML = escapeHtml( player_struct.display_name );
	
	document.getElementById("dlg_player_id").href = "https://playoverwatch.com/en-us/career/pc/"+player_struct.id;
	document.getElementById("dlg_player_id").innerHTML = player_struct.id;
	
	if ( player_struct.private_profile === true ) {
		document.getElementById("dlg_player_private_profile").style.display = "inline";
	} else {
		document.getElementById("dlg_player_private_profile").style.display = "none";
	}
	
	document.getElementById("dlg_player_display_name").value = player_struct.display_name;
	if( player_struct.ne === true )  {
		document.getElementById("dlg_player_name_edited").style.visibility = "visible";
	} else {
		document.getElementById("dlg_player_name_edited").style.visibility = "";
	}
	
	document.getElementById("dlg_player_level").value = player_struct.level;
	
	document.getElementById("dlg_player_pinned").checked = pinned_players.has( player_struct.id );
	
	document.getElementById("dlg_player_checkin").checked = checkin_list.has( player_struct.id );
	
	// fill class table	
	document.getElementById("dlg_player_class_table").innerHTML = "";
	// prepare array of classes, ordered for specified player (main class is first)
	var class_order = [];
	if ( Array.isArray(player_struct.classes) ) {
		for( i=0; i<player_struct.classes.length; i++ ) {
			class_order.push( player_struct.classes[i] );
		}
	}
	for( let class_name of class_names ) {
		if ( class_order.indexOf(class_name) == -1 ) {
			class_order.push( class_name );
		}
	}
	for( let class_name of class_order ) {
		var class_row = player_class_row_add();
		
		//var class_name = player_struct.classes[i];
		var class_checkbox = class_row.getElementsByClassName("dlg-class-enabled-checkbox")[0];
		if ( player_struct.classes.indexOf(class_name) == -1 ) {
			class_checkbox.checked = false;
			class_row.classList.add("class-disabled");
		} else {
			class_checkbox.checked = true;
		}
		
		var class_title = class_row.getElementsByClassName("dlg-class-name")[0];
		class_title.innerHTML = class_name;		
		
		var class_img = class_row.getElementsByClassName("class-icon-dlg")[0];
		class_img.src = "class_icons/"+class_name+".png";
		
		var sr_edit = class_row.getElementsByClassName("dlg-sr-by-class")[0];
		var sr = player_struct.sr_by_class[class_name];
		if ( sr == undefined ) {
			sr = 0;
		}
		sr_edit.value = sr;
		
		var rank_name = get_rank_name( sr );
		var sr_img = class_row.getElementsByClassName("rank-icon-dlg")[0];	
		sr_img.src = "rank_icons/"+rank_name+"_small.png";
		sr_img.title = rank_name;
		
		var time_played = player_struct.playtime_by_class[class_name];
		if ( time_played == undefined ) {
			time_played = 0;
		}
		var time_span = class_row.getElementsByClassName("dlg-payer-class-playtime")[0];
		time_span.innerHTML =  time_played + " hrs";
	}
	
	
	if( player_struct.se === true ) {
		var marks = document.getElementById("dlg_player_class_table").getElementsByClassName("dlg-edited-mark-sr");
		for( i=0; i<marks.length; i++ ) {
			marks[i].style.visibility = "visible";
		}
	}
	
	document.getElementById("dlg_top_heroes_icons").innerHTML = "";
	if ( Array.isArray(player_struct.top_heroes) ) {
		for( i=0; i<player_struct.top_heroes.length; i++ ) {
			var hero_id = player_struct.top_heroes[i].hero;
			if( hero_id == "soldier76") {
				hero_id = "soldier-76";
			}
			if( hero_id == "wrecking_ball") {
				hero_id = "wrecking-ball";
			}
			var img_node = document.createElement("img");
			img_node.className = "hero-icon";
			img_node.src = "https://blzgdapipro-a.akamaihd.net/hero/"+hero_id+"/hero-select-portrait.png";
			img_node.title = hero_id + "\nPlayed: " + player_struct.top_heroes[i].playtime+" h";
			document.getElementById("dlg_top_heroes_icons").appendChild(img_node);
		}
	}
	
	if( player_struct.ce === true )  {
		document.getElementById("dlg_player_class1_edited").style.visibility = "visible";
	} else {
		document.getElementById("dlg_player_class1_edited").style.visibility = "";
	}
	
	document.getElementById("dlg_edit_player_last_updated").innerHTML = print_date(player_struct.last_updated);
	document.getElementById("dlg_update_player_stats_loader").style.display = "none";
	
	if (clear_errors) {
		document.getElementById("dlg_edit_player_update_result").style.display = "none";
		document.getElementById("dlg_edit_player_update_result").innerHTML = "";
	}
}

function fill_settings_dlg( settings_obj ) {
	for ( setting_name in settings_obj ) {
		var setting_value = settings_obj[setting_name];
		if ( setting_name == "slots_count" ) {
			continue;
		}
		var setting_input = document.getElementById(setting_name);
		if (setting_input === null) { alert("broken setting: "+setting_name);}
		switch( setting_input.type ) {
			case "checkbox":
				setting_input.checked = setting_value;
				break;
			default:
				setting_input.value = setting_value;
		}
	}
	
	var setting_name = "slots_count";
	for ( class_name in settings_obj[setting_name] ) {
		var setting_input = document.getElementById(setting_name+"_"+class_name);
		if (setting_input === null) { alert("broken setting: "+setting_name);}
		var setting_value = settings_obj[setting_name][class_name];
		setting_input.value = setting_value;
	}
		
	adjust_sr_change();
}

function get_parent_element( current_element, parent_tagname ) {
	var parent_element = current_element;
	// ascend in dom tree 
	while ( parent_element.tagName != parent_tagname ) {
		parent_element = parent_element.parentElement;
		if ( parent_element == null ) {
			return null;
		}
	}
	return parent_element;
}

function highlight_player( player_id ) {
	document.getElementById(player_id).classList.toggle("player-highlighted", true);
	setTimeout( reset_highlighted_players, 2000 );
}

function highlight_players( player_list ) {
	for( i=0; i<player_list.length; i++ ) {
		var player_id = "";
		if ( typeof player_list[i] == "string" ) {
			player_id = player_list[i];
		} else {
			player_id = player_list[i].id;
		}
		document.getElementById(player_id).classList.toggle("player-highlighted", true);
	}
	
	setTimeout( reset_highlighted_players, 2000 );
}

function log_stats_update_error( msg ) {
	var log_text = document.getElementById("stats_update_log").value;
	log_text = (log_text + "\n" + msg).trim();
	document.getElementById("stats_update_log").value = log_text;
	
	document.getElementById("stats_update_errors").style.visibility = "visible";
	document.getElementById("stats_update_errors_count").innerHTML = log_text.split("\n").length;
}

function open_dialog( dialog_id ) {
	document.getElementById( dialog_id ).style.display = "block";
}

function player_class_row_add() {
	var class_table = document.getElementById("dlg_player_class_table");
	var row = class_table.insertRow(-1);
	row.className = "dlg-player-class-row";
	
	var cell, img, input_node, text_node, span_node;
	
	cell = row.insertCell(-1);
	input_node = document.createElement("input");
	input_node.type = "checkbox";
	input_node.title = "class enabled for balance";
	input_node.className = "dlg-class-enabled-checkbox";
	input_node.checked = true;
	input_node.onchange = function(event){on_player_edit_class_toggled(event);};
	cell.appendChild(input_node);
	
	
	cell = row.insertCell(-1);
	cell.style = "text-align: left;";
	img = document.createElement("img");
	img.className = "class-icon-dlg";
	img.src = "class_icons/"+class_names[0]+".png";
	cell.appendChild(img);
	span_node = document.createElement("span");
	span_node.className = "dlg-class-name";
	text_node = document.createTextNode( "class_name" );
	span_node.appendChild(text_node);
	cell.appendChild(span_node);
	
	
	cell = row.insertCell(-1);
	img = document.createElement("img");
	img.className = "rank-icon-dlg";
	img.src = "rank_icons/unranked_small.png";
	cell.appendChild(img);
	input_node = document.createElement("input");
	input_node.className = "dlg-sr-by-class";
	input_node.type = "number";
	input_node.min = 0;
	input_node.max = 4999;
	input_node.value = 0;
	input_node.oninput = function(event){on_player_class_sr_changed(event);};
	cell.appendChild(input_node);
	text_node = document.createTextNode( " SR " );
	cell.appendChild(text_node);
	span_node = document.createElement("span");
	span_node.className = "dlg-edited-mark-sr";
	span_node.title = "SR was manually edited";
	span_node.style.visibility = "hidden";
	span_node.onclick = function(event){clear_edited_mark('se');};
	text_node = document.createTextNode( "\u270D" );
	span_node.appendChild(text_node);
	cell.appendChild(span_node);
	
	
	cell = row.insertCell(-1);
	span_node = document.createElement("span");
	span_node.className = "dlg-payer-class-playtime";
	text_node = document.createTextNode( "0 hrs" );
	span_node.appendChild(text_node);
	cell.appendChild(span_node);
	
	
	cell = row.insertCell(-1);
	input_node = document.createElement("input");
	input_node.type = "button";
	input_node.value = "\u2191";
	input_node.onclick = function(event){player_class_row_moveup(event);};
	input_node.title = "move class higher";
	cell.appendChild(input_node);
	input_node = document.createElement("input");
	input_node.type = "button";
	input_node.value = "\u2193";
	input_node.onclick = function(event){player_class_row_movedown(event);};
	input_node.title = "move class lower";
	cell.appendChild(input_node);
	input_node = document.createElement("input");
	
	return row;
}

function redraw_lobby() {
	var team_container = document.getElementById("lobby");
	team_container.innerHTML = "";
	for( var i=0; i<lobby.length; i++) {
		var player_widget = draw_player( lobby[i] );
		team_container.appendChild(player_widget);
	}
	for( i=lobby.length; i<get_team_size(); i++) {
		var player_widget = draw_player( create_empty_player() );
		team_container.appendChild(player_widget);
	}
	
	document.getElementById("lobby_count").innerHTML = lobby.length;
		
	if (document.getElementById("lobby_filter").value != "") {
		apply_lobby_filter();
	}
	
	//check-in counter
	document.getElementById("checkin_counter").innerHTML = checkin_list.size;
}

function redraw_player( player_struct ) {
	var is_small = (lobby.indexOf(player_struct) == -1);
	
	var player_cell_old = document.getElementById( player_struct.id );
	var player_item_row = player_cell_old.parentElement;
	
	var slot_class = undefined;
	if (is_small && is_role_lock_enabled()) {
		// find player slot
		for (var team_slots of [team1_slots, team2_slots]) {
			var tmp = get_player_role( team_slots, player_struct );
			if (tmp !== undefined ) {
				slot_class = tmp;
				break;
			}
		}
	}
	
	var player_cell_new = draw_player_cell( player_struct, is_small, false, slot_class );
	player_item_row.replaceChild( player_cell_new, player_cell_old );
	
	update_teams_sr();
}

function redraw_teams() {
	redraw_team( 1, team1, team1_slots );
	redraw_team( 2, team2, team2_slots );

	update_teams_sr();
	
	save_players_list();
}

function redraw_team( team_number, players_array, players_slots ) {
	var team_container = document.getElementById("team"+team_number);
	team_container.innerHTML = "";
	
	if ( is_role_lock_enabled() ) {
		// draw players from slots (role lock)
		for( let class_name of class_names ) {
			var players_drawn = 0;
			
			if ( players_slots[class_name] != undefined ) {
				for( var i=0; i<players_slots[class_name].length; i++) {
					var player_widget = draw_player( players_slots[class_name][i], true, false, class_name );
					team_container.appendChild(player_widget);
					players_drawn++;
				}
			}
			
			// add empty slots up to slots count
			for( var i=players_drawn; i<Settings["slots_count"][class_name]; i++) {
				var player_widget = draw_player( create_empty_player(), true, false, class_name );
				team_container.appendChild(player_widget);
			}
		}
	} else {
		// draw players from array (no role lock)
		for( var i=0; i<players_array.length; i++) {
			var player_widget = draw_player( players_array[i], true );
			team_container.appendChild(player_widget);
		}
		
		// add empty slots up to team size
		var team_size = get_team_size();
		for( i=players_array.length; i<team_size; i++) {
			var player_widget = draw_player( create_empty_player(), true );
			team_container.appendChild(player_widget);
		}
	}
}

function reset_highlighted_players() {
	var elems = document.getElementsByClassName( "player-highlighted" );
	for( i=0; i<elems.length; i++ ) {
		elems[i].classList.toggle("player-highlighted", false);
	}
}

function reset_roll() {
	for( t in teams ) {
		lobby = lobby.concat( teams[t].players.splice( 0, teams[t].players.length) );
	}
	teams.splice( 0, teams.length );
	
	save_players_list();
	redraw_lobby();
	redraw_teams();
}

function select_html( html_container ) {
	if (document.body.createTextRange) {
		const range = document.body.createTextRange();
		range.moveToElementText(html_container);
		range.select();
	} else if (window.getSelection) {
		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(html_container);
		selection.removeAllRanges();
		selection.addRange(range);
	}
}

function update_teams_sr() {
	document.getElementById("team1_sr").innerHTML = calc_team_sr(team1, team1_slots);
	document.getElementById("team2_sr").innerHTML = calc_team_sr(team2, team2_slots);
}
