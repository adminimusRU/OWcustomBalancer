var Balancer = {
	players: [], // active players from lobby
	team1: [], // output team
	team2: [], // output team
	
	// callbacks
	onDebugMessage: undefined,
	
	// settings
	team_size: 6,
	// while calculating player's SR will be adjusted by given percent, depenging on player's main class
	// example: adjust_sr_by_class: {'dps':120, 'tank':100, 'support':80},
	adjust_sr: false,
	adjust_sr_by_class: {},
	// 0 - prioritize SR, 100 - prioritize classes
	balance_priority: 50,
	// do not place similar one-trick-ponies together
	separate_otps: true,
	// combinations with objective function value within range of [OF_min...OF_min+OF_thresold] are considered as balanced
	OF_thresold: 30,
	roll_debug: false,
		
	// internal
	balance_max_sr_diff: 100,
	
	player_selection_mask: [],
	
	OF_min: 0,
	combinations: new Map(),
	
	// public methods
	balanceTeams: function() {
		if ( this.players.length < this.team_size ) {
			this.team1 = this.players;
			this.players = [];
			return;
		}
		
		// init
		// start at ...00000111110
		this.player_selection_mask = Array(this.players.length - this.team_size).fill(0).concat( Array(this.team_size).fill(1) );
		this.player_selection_mask[this.players.length-1] = 0;
		
		this.OF_min = Number.MAX_VALUE;
		
		// iterate through all possible player combinations and calc objective function
		while ( this.findNextMask() ) {
			var picked_players_team1 = this.pickPlayersByMask( this.player_selection_mask );
			var picked_players_team2 = this.pickPlayersByMask( this.maskInvert(this.player_selection_mask) );
			
			// calc objective function
			var OF_current = this.calcObjectiveFunction( picked_players_team1, picked_players_team2 );
			
			if ( OF_current < this.OF_min ) {
				this.OF_min = OF_current;
			}
			
			// store combination in map
			var mask_string = this.maskToString( this.player_selection_mask );
			this.combinations.set( mask_string, OF_current );
			
			if (this.roll_debug) {
				if(typeof this.onDebugMessage == "function") {
					var picked_players_string = "{ ";
					picked_players_team1.forEach( function(item) {
						picked_players_string += item.id+",";
					});
					picked_players_string += " }";
					this.onDebugMessage.call( undefined, mask_string + " = " + picked_players_string+" = "+OF_current );
				}
			}
		};
		
		// filter balanced combinations within OF thresold and return random one
		var balanced_combinations = [];
		for (var [mask_string, OF_value] of this.combinations) {
			if ( (OF_value-this.OF_min) <= this.OF_thresold ) {
				balanced_combinations.push( mask_string );
			}
		}
		if (this.roll_debug) {
			if(typeof this.onDebugMessage == "function") {
				this.onDebugMessage.call( undefined, "best combinations:" );
				for ( let mask_string of balanced_combinations ) {
					this.onDebugMessage.call( undefined, mask_string );
				}
			}
		}
		var selected_mask_string = balanced_combinations[ Math.floor(Math.random() * (balanced_combinations.length)) ];
		if (this.roll_debug) {
			if(typeof this.onDebugMessage == "function") {
				this.onDebugMessage.call( undefined, "selected combination = "+selected_mask_string );
			}
		}
		this.player_selection_mask = this.maskFromString( selected_mask_string );
		this.team1 = this.pickPlayersByMask( this.player_selection_mask, true );
		
		this.team2 = [];
		for( let i=0; i<this.team_size; i++ ) {
			let player = this.players.pop();
			if ( player !== undefined ) {
				this.team2.push( player );
			} else {
				break;
			}
		}
		
		sort_players( this.team1, 'sr' );
		sort_players( this.team2, 'sr' );
	},
	
	// private methods
	
	findNextMask: function() {
		return this.findNextMaskIncrement();
	},
	
	findNextMaskIncrement: function() {
		while(true) {
			// binary increment mask
			var buf = 1;
			var bits_count = 0;
			
			for ( var index = this.player_selection_mask.length - 1; index >=0; index-- ) {
				buf += this.player_selection_mask[ index ];
				this.player_selection_mask[ index ] = buf % 2;
				buf -= this.player_selection_mask[ index ];
				buf = buf >> 1;
				
				bits_count += this.player_selection_mask[ index ];
			}
			
			if ( buf > 0 ) {
				return false; // overflow reached, no correct mask found
			}
			
			// check if mask has needed amount of bits
			if ( bits_count == this.team_size ) {
				return true;
			}
			
			// stop at 111111000000...
			var sum_head = 0;
			for ( index=0; index<this.team_size; index++ ) {
				sum_head += this.player_selection_mask[ index ];
			}
			if ( sum_head == this.team_size ) {
				return false;
			}
		}
		return false;
	},
	
	pickPlayersByMask: function( mask, remove_selected=false ) {
		var picked_players = [];
		for( i in mask ) {
			if ( mask[i] == 1 ) {
				picked_players.push( this.players[i] );
			}
		}
		
		if ( remove_selected ) {
			for ( i=mask.length-1; i>=0; i-- ) {
				if ( mask[i] == 1 ) {
					this.players.splice( i, 1 );
				}
			}
		}
		
		return picked_players;
	},
	
	calcObjectiveFunction: function( team1, team2 ) {
		var sr_diff = Math.abs( this.calcTeamSR(team1) - this.calcTeamSR(team2) );
		var class_unevenness = this.calcClassUnevenness( team1, team2 );
		var otp_conflicts = 0;
		if (this.separate_otps) {
			otp_conflicts = this.calcOTPConflicts( team1 ) + this.calcOTPConflicts( team2 );
		}
		
		var objective_func = this.calcObjectiveFunctionValue( sr_diff, class_unevenness, otp_conflicts );
		if (this.roll_debug) {
			if(typeof this.onDebugMessage == "function") {
				this.onDebugMessage.call( undefined, "team1 sr = " + this.calcTeamSR(team1) + ", team2 sr = " + this.calcTeamSR(team2) +", sr diff = "+sr_diff+
					", cu = "+class_unevenness+", otp = "+otp_conflicts+", of = "+objective_func );
			}
		}
		
		return objective_func;
	},
	
	calcObjectiveFunctionValue: function( sr_diff, class_unevenness, otp_conflicts ) {
		var OF = 
			(class_unevenness * this.balance_priority
			+ (sr_diff/this.balance_max_sr_diff*100)*(100-this.balance_priority)
			+ otp_conflicts )
			/100 ;
		return round_to( OF, 1 );
	},
	
	calcTeamSR: function( team ) {
		var team_sr = 0;
		if (team.length > 0) {
			for( var i=0; i<team.length; i++) {
				var player_sr = team[i].sr;
				player_sr = this.calcPlayerSR( team[i] );
				team_sr += player_sr;
			}
			team_sr = Math.round(team_sr / this.team_size);
		}
		return team_sr;
	},
	
	calcPlayerSR: function ( player ) {
		var player_sr = player.sr;
		if ( this.adjust_sr ) {
			if ( player.top_classes !== undefined ) {
				var top_class = player.top_classes[0];
				if( (top_class !== undefined) && (player.top_classes.length == 1) ) {
					player_sr = Math.round( player_sr * is_undefined(this.adjust_sr_by_class[top_class],100)/100 );
				}
			}
		}
		return player_sr;
	},
	
	calcClassUnevenness: function ( team1, team2 ) {
		var class_count = [];
		
		var teams = [team1, team2];
		for ( let t in teams ) {
			var current_class_count = {};
			for( let class_name of class_names ) {
				current_class_count[class_name] = 0;
			}
			
			for( let player of teams[t]) {
				if ( player.top_classes.length == 2 ) {
					current_class_count[player.top_classes[0]] += 2/3;
					current_class_count[player.top_classes[1]] += 1/3;
				} else if ( player.top_classes.length == 1 ) {
					current_class_count[player.top_classes[0]] += 1;
				}
			}
			
			class_count[t] = current_class_count;
		}
		
		var total_class_unevenness = 0;
		for( let class_name of class_names ) { 
			total_class_unevenness += this.calcClassUnevennessValue( class_count[0][class_name], class_count[1][class_name] ); 
		}
		
		return round_to( total_class_unevenness, 1 );
	},
	
	calcClassUnevennessValue: function ( class_count_1, class_count_2 ) {
		return 100*Math.pow((class_count_1 - class_count_2), 2);
	},
	
	calcOTPConflicts: function( team ) {
		var otp_conflicts_count = 0;
		// array of one-trick ponies (hero names) in current team
		var current_team_otps = []; 
		for( p in team) {
			if ( team[p].top_heroes.length == 1 ) {
				var current_otp = team[p].top_heroes[0].hero;
				if (current_team_otps.indexOf(current_otp) == -1) {
					current_team_otps.push( current_otp );
				} else {
					otp_conflicts_count++;
				}
			}
		}
		
		return otp_conflicts_count * 10000;	
	},
	
	maskToString: function( mask ) {
		return mask.join('');
	},
	
	maskFromString: function( mask_string ) {
		mask = mask_string.split('');
		mask.forEach( function(item) {
			item = Number(item);
		});
		return mask;
	},
	
	maskInvert: function( mask ) {
		var mask_inv = [];
		for( let i=0; i<mask.length; i++ ) {
			mask_inv.push( (mask[i]==0 ? 1 : 0) );
		};
		return mask_inv;
	},
}