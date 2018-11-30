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
	
	// check if team size changed
	var new_team_size = Number(document.getElementById("team_size").value);
	if ( new_team_size != Settings["team_size"]  ) {
		teams_changed = true;
	}
	if ( Settings["team_size"] > new_team_size ) {
		// team size reduced - move excess players back to lobby
		for ( let team of [team1, team2] ) {
			while ( team.length > new_team_size ) {
				let removed_player = team.pop();
				lobby.push( removed_player );
			}
		}
	}
	
	for ( setting_name in Settings ) {
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
	Balancer.team_size = Settings.team_size;
	Balancer.adjust_sr = Settings.adjust_sr;
	Balancer.adjust_sr_by_class = {
			tank: Settings.adjust_tank,
			dps: Settings.adjust_dps,
			support: Settings.adjust_support,
		};
	Balancer.balance_priority = Settings.balance_priority;
	Balancer.separate_otps = Settings.separate_otps;
	
	Balancer.players = team1.concat( team2 );
	
	Balancer.roll_debug = false;
	Balancer.onDebugMessage = on_balance_debug;
	
	Balancer.balanceTeams();
	
	team1 = Balancer.team1.slice();
	team2 = Balancer.team2.slice();
	
	if ( Balancer.players.length > 0 ) {
		lobby = lobby.concat( Balancer.players );
		redraw_lobby();
	}
	
	save_players_list();
	
	Balancer.team1 = [];
	Balancer.team2 = [];
	Balancer.players = [];
	
	redraw_teams();
}

function clear_lobby() {
	if( confirm("Permanently delete all players?") ) {
		lobby.splice( 0, lobby.length );
		save_players_list();
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
			document.getElementById("dlg_player_sr_edited").style.visibility = "";
			break;
		case 'ce': 
			player_struct.ce = false;
			document.getElementById("dlg_player_class1_edited").style.visibility = "";
			document.getElementById("dlg_player_class2_edited").style.visibility = "";
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
	
	var new_sr = Number(document.getElementById("dlg_player_sr").value);
	if ( player_struct.sr != new_sr ) {
		player_struct.se = true; // sr edited
	}
	player_struct.sr = new_sr;
	
	var top_classes = [];
	top_classes.push( document.getElementById("dlg_main_class").value );
	if ( document.getElementById("dlg_secondary_class").value !== "" ) {
		top_classes.push( document.getElementById("dlg_secondary_class").value );
	}
	if ( player_struct.top_classes.length != top_classes.length ) {
		player_struct.ce = true; // class edited
	} else {
		for (i in top_classes) {
			if ( top_classes[i] != player_struct.top_classes[i] ) {
				player_struct.ce = true;
				break;
			}
		}
	}
	player_struct.top_classes = top_classes;
		
	close_dialog("popup_dlg_edit_player");
	save_players_list();
	redraw_player( player_struct );
	
	player_being_edited = undefined;
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

function move_team_to_lobby(team) {
	lobby = lobby.concat(team);
	team.splice( 0, team.length );
	//update_captains();
	save_players_list();
	redraw_lobby();
	redraw_teams();
}

function open_stats_update_log() {
	open_dialog("popup_dlg_stats_log");
}

function reset_settings() {
	fill_settings_dlg( get_default_settings() );
}

function settings_dlg_open() {
	fill_settings_dlg( Settings );
	open_dialog( "popup_dlg_settings" );
}

function sort_lobby( sort_field = 'sr' ) {
	sort_players(lobby, sort_field);
	save_players_list();
	redraw_lobby();
}


function sort_team( team, sort_field = 'sr' ) {
	sort_players( team, sort_field );
}

function sort_team_click( team_index, sort_field = 'sr' ) {
	sort_team( team_index, sort_field );
	save_players_list();
	redraw_teams();
}

function sort_teams_players( sort_field = 'sr' ) {
	for( var t in teams ) {
		sort_team( t, sort_field );
	}
	save_players_list();
	redraw_teams();
}

function stop_stats_update() {
	StatsUpdater.stop( true );
}

function test() {
	
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
		case "active":
			StatsUpdater.addToQueue( team1, stats_max_age );
			StatsUpdater.addToQueue( team2, stats_max_age );
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

function on_lobby_filter_change() {
	clearTimeout( lobby_filter_timer );
	lobby_filter_timer = setTimeout( apply_lobby_filter, 400 );
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
	}
	
	// find index in team for player
	var selected_index = get_player_index( selected_id, selected_team );
	var selected_player = selected_team[selected_index];
	
	// detect target team
	var new_team;
	if (selected_team == lobby) {
		// find team with empty slot
		for( let team of [team1, team2] ) {
			if ( team.length < Settings.team_size ) {
				new_team = team;
				break;
			}
		}
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
	//var dragged_team_struct;
	var dragged_index;
	var dragged_player;
	var target_team;
	//var target_team_struct;
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
				//dragged_team_struct = teams[t];
				dragged_index = i;
				dragged_player = team[i];
			}
			if ( target_id == team[i].id) {
				target_team = team;
				//target_team_struct = teams[t];
				target_index = i;
				target_player = team[i];
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
			target_team = team1;
			target_index = team1.length;
		} else if (parent_id == "team2") {
			target_team = team2;
			target_index = team2.length;
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

function on_balance_debug( dbg_msg ) {
	document.getElementById("debug_log").innerHTML += dbg_msg+"</br>";
}

function on_player_stats_updated( player_id ) {
	if ( player_being_added !== undefined ) {
		if ( player_id == player_being_added.id ) {
			// add new player to team with empty slots or lobby
			var target_team = lobby;
			for ( let team of [team1, team2] ) {
				if (team.length < Settings.team_size ) {
					target_team = team;
					break;
				}
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
				fill_player_stats_dlg();
				
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
				var target_team = lobby;
				for ( let team of [team1, team2] ) {
					if (team.length < Settings.team_size ) {
						target_team = team;
						break;
					}
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
			document.getElementById("dlg_edit_player_update_result").innerHTML = escapeHtml( error_msg );
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

function draw_player( player_struct, small=false, is_captain=false ) {
	var new_player_item_row = document.createElement("div");
	new_player_item_row.className = "row";
	
	var new_player_cell = draw_player_cell( player_struct, small, is_captain );
	new_player_item_row.appendChild(new_player_cell);
	
	return new_player_item_row;
}

function draw_player_cell( player_struct, small=false, is_captain=false ) {
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
		new_player_item.title += "\nSR: " + player_struct.sr;
		new_player_item.title += "\nLevel: " + player_struct.level;
		new_player_item.title += "\nMain class: " + is_undefined(player_struct.top_classes[0], "-");
		new_player_item.title += "\nSecondary class: " + is_undefined(player_struct.top_classes[1], "-");
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
	
	// rank icon
	var player_icon = document.createElement("div");
	player_icon.className = "player-icon";
	if ( small ) {
		player_icon.classList.add("player-icon-small");
	}
		
	var icon_image = document.createElement("div");
	icon_image.className = "icon-image";
	
	var img_node = document.createElement("img");
	img_node.className = "rank-icon";
	if ( small ) {
		img_node.classList.add("rank-icon-small");
	}
	var rank_name = get_rank_name(player_struct.sr);
	img_node.src = "rank_icons/"+rank_name+"_small.png";
	img_node.title = rank_name;
	icon_image.appendChild(img_node);
	player_icon.appendChild(icon_image);
	
	// SR value
	if ( ! small ) {
		br_node = document.createElement("br");
		player_icon.appendChild(br_node);
	
		var icon_sr = document.createElement("div");
		icon_sr.className = "icon-sr";
	
		var sr_display = document.createElement("span");
		sr_display.id = "sr_display_"+player_struct.id;
		var sr_text = player_struct.sr;
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
	}
	
	new_player_item.appendChild(player_icon);
	
	// space after rank icon
	text_node = document.createTextNode("\u00A0");
	new_player_item.appendChild(text_node)
	
	// player name
	var player_name = document.createElement("div");
	if ( small ) {
		player_name.className = "player-name-small";
	} else {
		player_name.className = "player-name";
	}
		
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
	
	// class icons
	if ( player_struct.top_classes !== undefined ) {
		for(var i=0; i<player_struct.top_classes.length; i++) {
			var class_icon = document.createElement("img");
			class_icon.className = "class-icon";
			if ( small ) {
				class_icon.classList.add("class-icon-small");
			}
			if( i != 0 )  {
				class_icon.classList.add("secondary-class");
			}
			if( player_struct.ce === true ) {
				class_icon.classList.add("class-edited");
			}
			class_icon.src = "class_icons/"+player_struct.top_classes[i]+".png";
			class_icon.title = player_struct.top_classes[i];
			new_player_item.appendChild(class_icon);
		}
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

function fill_player_stats_dlg() {
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
	
	document.getElementById("dlg_player_sr").value = player_struct.sr;
	if( player_struct.se === true )  {
		document.getElementById("dlg_player_sr_edited").style.visibility = "visible";
	} else {
		document.getElementById("dlg_player_sr_edited").style.visibility = "";
	}
	document.getElementById("dlg_player_level").value = player_struct.level;
	
	if ( Array.isArray(player_struct.top_classes) ) {
		if ( player_struct.top_classes.length > 0 ) {
			document.getElementById("dlg_main_class").value = player_struct.top_classes[0];
		}
		
		if ( player_struct.top_classes.length > 1 ) {
			document.getElementById("dlg_secondary_class").value = player_struct.top_classes[1];
		} else {
			document.getElementById("dlg_secondary_class").value = "";
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
		document.getElementById("dlg_player_class2_edited").style.visibility = "visible";
	} else {
		document.getElementById("dlg_player_class1_edited").style.visibility = "";
		document.getElementById("dlg_player_class2_edited").style.visibility = "";
	}
	
	document.getElementById("dlg_edit_player_last_updated").innerHTML = print_date(player_struct.last_updated);
	
	document.getElementById("dlg_update_player_stats_loader").style.display = "none";
	document.getElementById("dlg_edit_player_update_result").style.display = "none";
	document.getElementById("dlg_edit_player_update_result").innerHTML = "";
}

function fill_settings_dlg( settings_obj ) {
	for ( setting_name in settings_obj ) {
		var setting_value = settings_obj[setting_name];
		var setting_input = document.getElementById(setting_name);
		if (setting_input === null) { alert("help"+setting_name);}
		switch( setting_input.type ) {
			case "checkbox":
				setting_input.checked = setting_value;
				break;
			default:
				setting_input.value = setting_value;
		}
	}
		
	adjust_sr_change();
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

function redraw_lobby() {
	var team_container = document.getElementById("lobby");
	team_container.innerHTML = "";
	for( var i=0; i<lobby.length; i++) {
		var player_widget = draw_player( lobby[i] );
		team_container.appendChild(player_widget);
	}
	for( i=lobby.length; i<Settings.team_size; i++) {
		var player_widget = draw_player( create_empty_player() );
		team_container.appendChild(player_widget);
	}
	
	document.getElementById("lobby_count").innerHTML = lobby.length;
		
	if (document.getElementById("lobby_filter").value != "") {
		apply_lobby_filter();
	}
}

function redraw_player( player_struct ) {
	var player_item_row = document.getElementById( player_struct.id ).parentElement;
	var player_cell = draw_player_cell( player_struct, false, false );
	player_item_row.innerHTML = "";
	player_item_row.appendChild(player_cell);
	
	update_teams_sr();
}

function redraw_teams() {
	var teams = [team1, team2];
	for( let t in teams ) {
		var team_container = document.getElementById("team"+(Number(t)+1));
		team_container.innerHTML = "";
		for( var i=0; i<teams[t].length; i++) {
			var player_widget = draw_player( teams[t][i] );
			team_container.appendChild(player_widget);
		}
		// add empty players up to max team size
		for( i=teams[t].length; i<Settings.team_size; i++) {
			var player_widget = draw_player( create_empty_player() );
			team_container.appendChild(player_widget);
		}
	}

	update_teams_sr();
	
	save_players_list();
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
	document.getElementById("team1_sr").innerHTML = calc_team_sr(team1);
	document.getElementById("team2_sr").innerHTML = calc_team_sr(team2);
}
