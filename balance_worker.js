/*
*		Web Worker implementation to run Balancer in background
*/

importScripts("ow_defines.js");
importScripts("common.js");
importScripts("balancer.js");

onmessage = function(e) {
	if ( ! Array.isArray(e.data) ) {
		return;
	}
	if ( e.data.length == 0 ) {
		return;
	}
	
	var event_type = e.data[0];
	if ( event_type == "init" ) {		
		Balancer.onProgressChange = on_balance_progress;
		Balancer.onDebugMessage = on_balance_debug;
	} else if ( event_type == "settings" ) {
		if (e.data.length < 2) {
			return;
		}
		var settings_struct = e.data[1];
		for (var setting_name in settings_struct ) {
			if ( Balancer.hasOwnProperty(setting_name) ) {
				Balancer[setting_name] = settings_struct[setting_name];
			}
		}
	} else if ( event_type == "balance" ) {
		if (e.data.length < 2) {
			return;
		}
		var players = e.data[1];
		Balancer.players = players;		
		
		try {
			Balancer.balanceTeams();
		} catch(err) {
			postMessage(["error", err.message]);
			return;
		}
		
		var result_struct = {
			is_successfull: Balancer.is_successfull,
			is_rolelock: Balancer.is_rolelock,
			team1: Balancer.team1,
			team2: Balancer.team2,
			team1_slots: Balancer.team1_slots,
			team2_slots: Balancer.team2_slots,			
		}
		postMessage(["finish", result_struct]);
	}
}

function on_balance_progress( current_progress ) {
	var progress_struct = {
		current_progress: current_progress,
	}
	postMessage(["progress", progress_struct]);
}

function on_balance_debug( debug_msg ) {
	postMessage(["dbg", debug_msg]);
}
