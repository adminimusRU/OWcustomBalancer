const StatsUpdaterState = {
	idle: 1,
	updating: 2,
	waiting: 3,
};

var StatsUpdater = {
	queue: [], // players to update
	current_retry: 0,
	state: StatsUpdaterState.idle,
	
	totalQueueLength: 0,
	update_fails: 0,
	currentIndex: 0,
	current_id: "",
	
	// settings	
	min_api_request_interval: 6000, //milliseconds
	max_retry: 2,
	update_edited_fields: true,
	update_sr: true,
	update_class: true,
	region: "eu",
	
	// callbacks
	onPlayerUpdated: undefined,
	onComplete: undefined,
	onStart: undefined,
	onProgressChange: undefined,
	onError: undefined,
	onWarning: undefined,
	
	// add players to update queue and start update process
	// player_s - single player struct or array
	// stats_max_age - number of days. Only players with stats older than specified will be updated
	// high_priority - insert at queue head, otherwise at the end
	addToQueue: function( player_s, stats_max_age=0, high_priority=false ) {
		var max_stats_age_date = new Date(Date.now() - (stats_max_age*24*3600*1000));
		var added_count = 0;
		if ( Array.isArray(player_s) ) {
			if (player_s.length == 0 ) {
				return;
			}
			var insert_at = 1;
			for (i in player_s) {
				// check duplicates
				if ( this.queue.indexOf( player_s[i] ) !== -1 ) {
					continue;
				}
				// check stats age
				if ( player_s[i].last_updated > max_stats_age_date ) {
					continue;
				}
				if (high_priority) {
					this.queue.splice( insert_at, 0, player_s[i] );
					insert_at++;
				} else {
					this.queue.push( player_s[i] );
				}
				added_count++;
			}
		} else {
			// check duplicates
			var index_found = this.queue.indexOf( player_s );
			if ( (index_found !== -1) && (!high_priority) ) {
				// duplicate, do nothing
				return;
			}
			// check stats age
			if ( player_s.last_updated > max_stats_age_date ) {
				return;
			}
			
			if (high_priority && (index_found !== -1) ) {
				if (index_found <= 1) {
					// already at top, do nothing
					return;
				}
				// move to top
				this.queue.splice( index_found, 1 );
				this.queue.splice( 1, 0, player_s );
			} else if (high_priority) {
				// insert at index 1
				this.queue.splice( 1, 0, player_s );
				added_count++;
			} else {
				this.queue.push( player_s );
				added_count++;
			}
		}
		
		this.totalQueueLength += added_count;
		if ( added_count == 0 ) {
			// nothing really added to queue
			return;
		}
		
		if ( this.state == StatsUpdaterState.idle ) {
			this.currentIndex = 1;
			this.state = StatsUpdaterState.updating;
			
			this.updateNextPlayer();
			if(typeof this.onStart == "function") {
				this.onStart.call( undefined );
			}
		} else if ( this.state == StatsUpdaterState.updating ) {
			this.state = StatsUpdaterState.updating;
			if(typeof this.onProgressChange == "function") {
				this.onProgressChange.call( undefined );
			}
		} else if ( this.state == StatsUpdaterState.waiting ) {
			this.update_fails = 0;
			this.currentIndex = 1;
			this.current_id = this.queue[0].id;
			this.state = StatsUpdaterState.updating;
			setTimeout( this.updateNextPlayer.bind(this), this.min_api_request_interval );
			if(typeof this.onStart == "function") {
				this.onStart.call( undefined );
			}
		}
	},
	
	removeFromQueue: function( player_id ) {
		var index_found = -1;
		for ( var i=0; i<this.queue.length; i++) {
			if (this.queue[i].id == player_id ) {
				index_found = i;
				break;
			}
		}
		if ( index_found > 0 ) {
			this.queue.splice( index_found, 1 );
			this.totalQueueLength --;
		}
	},
	
	stop: function( terminate=false ) {
		if ( terminate ) {
			OWAPI.onSuccess = undefined;
			OWAPI.onFail = undefined;
			this.queue.splice( 0 );
			this.state = StatsUpdaterState.waiting;
			setTimeout( this.resetState.bind(this), this.min_api_request_interval );
			if(typeof this.onComplete == "function") {
				this.onComplete.call();
			}
		} else {
			if (this.queue.length > 1 ) {
				this.queue.splice( 1 );
			}
		}
	},
	
	// private functions
	
	updateNextPlayer: function() {
		if (this.queue.length == 0 ) {
			if(typeof this.onComplete == "function") {
				this.onComplete.call();
			}
			this.state = StatsUpdaterState.waiting;
			setTimeout( this.resetState.bind(this), this.min_api_request_interval );
			return;
		}
		player_struct = this.queue[0];
		
		OWAPI.id = player_struct.id;
		OWAPI.region = this.region;
		OWAPI.onSuccess = this.onOWAPISuccess.bind(StatsUpdater);
		OWAPI.onFail = this.onOWAPIFail.bind(StatsUpdater);
		OWAPI.getStats();

		this.current_id = player_struct.id;
		
		if(typeof this.onProgressChange == "function") {
			this.onProgressChange.call( undefined );
		}
	},
	
	resetState: function() {
		if ( this.state == StatsUpdaterState.waiting ) {
			this.totalQueueLength = 0;
			this.update_fails = 0;
			this.currentIndex = 0;
			this.state = StatsUpdaterState.idle;
		}
	},
	
	onOWAPISuccess: function() {
		var player = this.queue.shift();
		
		player.private_profile = false;
		player.level = OWAPI.level;
	
		// check if name was manually edited
		if ( (player.ne !== true) || this.update_edited_fields ) {
			player.display_name = OWAPI.display_name;
		}

		if( this.update_sr ) {
			if ( OWAPI.sr != 0 ) {
				// check if SR was manually edited and update option checked
				if ( (player.se !== true) || this.update_edited_fields ) {
					player.sr = OWAPI.sr;
					player.se = false;
				}
			} else {
				// log error
				var msg = "Player has 0 SR, not completed placements in current season";
				if(typeof this.onWarning == "function") {
					this.onWarning.call( undefined, OWAPI.id, msg );
				}
			}
		}
		
		if( this.update_class ) {
			if ( OWAPI.top_classes.length > 0 ) {
				// check if class was manually edited and update option checked
				if ( (player.ce !== true) || this.update_edited_fields ) {
					player.top_classes = OWAPI.top_classes;
					player.ce = false;
				}
			}
		}
		
		player.top_heroes = OWAPI.top_heroes;
		
		player.last_updated = new Date;
		
		delete player.empty;
				
		this.current_retry = 0;
		
		if ( this.queue.length > 0 ) {
			this.currentIndex++;
			setTimeout( this.updateNextPlayer.bind(this), this.min_api_request_interval );
		} else {
			this.state = StatsUpdaterState.waiting;
			this.totalQueueLength = 0;
			this.update_fails = 0;
			this.currentIndex = 0;
			if(typeof this.onComplete == "function") {
				this.onComplete.call();
			}
			setTimeout( this.resetState.bind(this), this.min_api_request_interval );
		}
		
		if(typeof this.onPlayerUpdated == "function") {
			this.onPlayerUpdated.call( undefined, player.id );
		}
	},
	
	onOWAPIFail: function ( msg ) {
		var is_changed = false;
		if ( OWAPI.can_retry == true && (this.current_retry < this.max_retry) ) {
			// retry
			this.current_retry++;
			setTimeout( this.updateNextPlayer.bind(this), this.min_api_request_interval );
		} else {
			// log error and update next player
			this.update_fails++;
			var player = this.queue.shift();
			this.current_retry = 0;
			
			if ( OWAPI.private_profile ) {
				player.private_profile = true;
				is_changed = true;
			}
			
			if(typeof this.onError == "function") {
				this.onError.call( undefined, OWAPI.id, msg, is_changed );
			}
			
			if ( this.queue.length > 0 ) {
				this.currentIndex++;
				setTimeout( this.updateNextPlayer.bind(this), this.min_api_request_interval );
			} else {
				this.state = StatsUpdaterState.waiting;
				this.totalQueueLength = 0;
				this.currentIndex = 0;
				if(typeof this.onComplete == "function") {
					this.onComplete.call();
				}
				setTimeout( this.resetState.bind(this), this.min_api_request_interval );
			}
			
		}
	},
}
