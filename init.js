/*
*		Initialization
*/

function convert_stored_data_v1() {
	// port saved players from v1
	var item_value = localStorage.getItem("saved_players");
	if ( item_value !== null ) {
		localStorage.setItem( storage_prefix+"lobby", item_value );
		localStorage.removeItem( "saved_players" );
	}

	var item_value = localStorage.getItem("saved_players_team1");
	if ( item_value !== null ) {
		localStorage.setItem( storage_prefix+"team1", item_value );
		localStorage.removeItem( "saved_players_team1" );
	}

	var item_value = localStorage.getItem("saved_players_team2");
	if ( item_value !== null ) {
		localStorage.setItem( storage_prefix+"team2", item_value );
		localStorage.removeItem( "saved_players_team2" );
	}

	// remove deprecated settings in storage
	var old_settings_list = [
		// from v1
		"region",
		"team1_name",
		"team2_name",
		"balance_adjust_sr",
		"balance_adjust_sr_dps",
		"balance_adjust_sr_tank",
		"balance_adjust_sr_support",
		"balance_class_uneveness_value",
		"balance_separate_otps",
		"balance_enable_captains",
		"update_class",
		"update_sr",
		"update_edited_fields",
		"update_picked",
		"dlg_setup_format",
		"dlg_setup_share_sr",
		"dlg_setup_share_classes",
		"dlg_setup_share_options",
		];
	for ( let i of old_settings_list ) {
		localStorage.removeItem( i );
	}
}

// -----------------

if ( localStorage.getItem("saved_players") !== null ) {
	convert_stored_data_v1();
}

// init stats updater
StatsUpdater.onPlayerUpdated = on_player_stats_updated;
StatsUpdater.onComplete = on_stats_update_complete;
StatsUpdater.onStart = on_stats_update_start;
StatsUpdater.onProgressChange = on_stats_update_progress;
StatsUpdater.onError = on_stats_update_error;
StatsUpdater.onWarning = on_stats_update_warning;

var stored_value;

// restore team names
for ( let id of ["team1_name", "team2_name"] ) {
	stored_value = localStorage.getItem( storage_prefix+id );
	if ( stored_value !== null ) {
		document.getElementById(id).value = stored_value;
	}
}

// restore settings
Settings = get_default_settings();
var saved_settings_json = localStorage.getItem( storage_prefix+"settings" );
if ( saved_settings_json != null ) {
	var saved_settings = JSON.parse(saved_settings_json);
	for ( var i in Settings ) {
		if ( saved_settings[i] !== undefined ) {
			Settings[i] = saved_settings[i];
		}
	}
}
apply_stats_updater_settings();

// restore role lock option 
stored_value = JSON.parse( localStorage.getItem(storage_prefix+"role_lock_enabled") );
if ( stored_value !== null ) {
	document.getElementById("role_lock_enabled").checked = stored_value;
}

// restore pinned list
stored_value = localStorage.getItem(storage_prefix+"pinned_players");
if ( stored_value != null ) {
	let pinned_array = JSON.parse(stored_value);
	pinned_players = new Set(pinned_array);
}

// restore checkin list
stored_value = localStorage.getItem(storage_prefix+"checkin");
if ( stored_value != null ) {
	let checkin_array = JSON.parse(stored_value);
	checkin_list = new Set(checkin_array);
}

// restore export options
var ExportOptions = get_default_export_options();
stored_value = localStorage.getItem( storage_prefix+"export_options" );
if ( stored_value != null ) {
	var saved_export_options = JSON.parse(stored_value);
	for ( var i in ExportOptions ) {
		if ( saved_export_options[i] !== undefined ) {
			ExportOptions[i] = saved_export_options[i];
		}
	}
}

//restore saved players to teams
restore_saved_teams();

// adjust lobby margin to account scrollbar width
var lobby_container = document.getElementsByClassName("lobby-container").item(0);
lobby_container.style.marginRight = "-"+get_scrollbar_width()+"px";
lobby_container.style.paddingRight = ""+get_scrollbar_width()+"px";

// load class and rank icons and convert them to data:uri strings, for team export
prepare_datauri_icons();

// init balancer worker
BalanceWorker = new Worker('balance_worker.js');
BalanceWorker.onmessage = on_balance_worker_message;
BalanceWorker.postMessage(["init"]);
