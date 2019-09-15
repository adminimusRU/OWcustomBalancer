/*
*		Team balancer
*/

var Balancer = {
	// input properties
	players: [], 			// put active players here
	
	// output properties
	team1: [], 				// output team 1 (without role lock)
	team2: [], 				// output team 2 (without role lock)
	team1_slots: {},		// output team 1 by classes (with role lock)
	team2_slots: {},		// output team 2 by classes (with role lock)
	is_successfull: false,	// indicates if any balanced combinations found
	is_rolelock: false, 	// if true, output teams are team1_slots and team2_slots
	
	
	// callbacks
	onDebugMessage: undefined,
	onProgressChange: undefined,
	
	
	// common settings	
	// by each class. Example: {'dps':2, 'tank':2, 'support':2}
	slots_count: {},
	// balancing algorithm
	// 	"classic" - old method without role lock
	//	"rolelock" - new method with roles
	//	"rolelockfallback" - try balance with role lock first. If not possible - uses classic method
	algorithm: "rolelockfallback",
	// do not place similar one-trick-ponies together
	separate_otps: true,
	// while calculating player's SR will be adjusted by given percent,
	// depenging on player's main class (classic method) or role slot in team (with role lock)
	// example: adjust_sr_by_class: {'dps':120, 'tank':100, 'support':80},
	adjust_sr: false,
	adjust_sr_by_class: {},
	// combinations with objective function value within range of [OF_min...OF_min+OF_thresold] are considered as balanced
	OF_thresold: 10,
	// if debug messages enabled through onDebugMessage callcack
	roll_debug: false,
	// 0 - minimum dbg messages
	// 1 - show details for best found combintation
	// 2 - show details for all combinations (could crash with role lock!)
	debug_level: 0,
	
	// setting for classic algorithm
	// method for calculating player SR as single number. See get_player_sr function
	classic_sr_calc_method: "main",
	// 0 - prioritize equal teams SR, 100 - prioritize equal classes (for classic algorithm without role lock)
	balance_priority_classic: 50,
	
	// setting for role lock algorithm
	// 0 - prioritize equal teams SR, 100 - prioritize players sitting on their main class (for new algorithm with role lock)
	balance_priority_rolelock: 50,
	
	
	// internal properties
	team_size: 0,
	
	// correction coefficient for SR difference in objective function calculation
	// 100 = no correction
	balance_max_sr_diff: 100,
	
	// bit mask for selecting players. 1 = player in team 1, 0 = in team 2.
	player_selection_mask: [],
	// arrays of players' structures for current combination
	picked_players_team1: [],
	picked_players_team2: [],
	
	// mask for current class combination (role lock balancer)
	// each element is index of selected class (index in player.classes) of specified player
	// elements are handled as digits of specified base (=amount of game classes)
	class_selection_mask: [],
	
	// array for counting classes in current combination (role lock balancer)
	// index in array = index of class in class_names
	// value = amount of players on specified class in team
	combination_class_count: [],		
	
	// current minimum value for objective function
	OF_min: 0,
	
	// map for storing found valid combinations of players (and classes for role lock balancer)
	// key = player selection mask as string (classic balancer)
	//		or player selection mask and class selection masks for both teams as strings, separated by space (role lock balancer)
	// value = objective function value
	combinations: new Map(),
	
	// array of best found balance variants
	balanced_combinations: [],
	
	// string with all balancer input data (setting and players) from previuos run
	old_state: "",
	
	dbg_class_combinations: 0,
	dbg_printed_lines: 0,
	
	
	
	// public methods
	
	balanceTeams: function() {
		var start_time = performance.now();
		
		// calc total team size
		this.team_size = 0;
		for( let class_name in this.slots_count ) {
			this.team_size += this.slots_count[class_name];
		}
		this.debugMsg( "team size="+this.team_size );
		
		// init output properties
		this.team1 = [];
		this.team2 = [];
		init_team_slots( this.team1_slots );
		init_team_slots( this.team2_slots );
		
		// check if we have enough players
		if ( this.players.length < this.team_size ) {
			this.debugMsg( "not enough players" );
			this.is_successfull = false;
			this.is_rolelock = false;
			return;
		}
		
		// sort players by id
		// otherwise combinations cache will be invalid
		this.players.sort( function(player1, player2){				
				return ( player1.id<player2.id ? -1 : (player1.id>player2.id?1:0) )
			} );
			
		// check if all input data is identical to previous run
		this.debugMsg( "old state: "+this.old_state, 1 );
		var new_state = this.getBalancerStateString();
		this.debugMsg( "new state: "+new_state, 1 );
		
		if ( new_state == this.old_state ) {
			this.debugMsg( "input data not changed, returning another variant from cache" );
			if ( this.is_rolelock ) {
				this.is_successfull = this.buildRandomBalanceVariantRolelock();
			} else {
				this.is_successfull = this.buildRandomBalanceVariantClassic();
			}
		} else {
			this.debugMsg( "input data changed, calculating new balance" );
			this.old_state = new_state;
			
			// balance magic			
			if ( this.algorithm == "classic" ) {
				this.debugMsg( "using classic alg" );
				this.is_successfull = this.balanceTeamsClassic();
				this.is_rolelock = false;
			} else if ( this.algorithm == "rolelock" ) {
				this.debugMsg( "using rolelock alg" );
				this.is_successfull = this.balanceTeamsRoleLock();
				this.is_rolelock = true;
			} else if ( this.algorithm == "rolelockfallback" ) {
				this.debugMsg( "using rolelockfallback alg" );
				this.is_successfull = this.balanceTeamsRoleLock();
				if ( this.is_successfull ) {
					this.is_rolelock = true;
				} else {
					this.debugMsg( "balance not possible with role lock, fallback to classic" );
					this.is_successfull = this.balanceTeamsClassic();
					this.is_rolelock = false;
				}			
			} else {
				this.debugMsg( "unknown alg"+this.algorithm );
				this.is_successfull = false;
				this.is_rolelock = false;
			}
		}
		
		var execTime = performance.now() - start_time;
		this.debugMsg( "Exec time "+execTime+" ms" );
	},
	
	
	// private methods
	
	balanceTeamsClassic: function() {
		// init
		this.initPlayerMask();		
		this.OF_min = Number.MAX_VALUE;
		this.combinations.clear();
		this.dbg_printed_lines = 0;
		
		// iterate through all possible player combinations and calc objective function (OF)
		// best balanced combinations are with minimum OF value, 0 = perfect
		while ( this.findNextPlayerMask() ) {
			this.picked_players_team1 = this.pickPlayersByMask( this.player_selection_mask );
			this.picked_players_team2 = this.pickPlayersByMask( this.maskInvert(this.player_selection_mask) );
			
			// calc objective function
			var OF_current = this.calcObjectiveFunctionClassic();
			
			if ( OF_current < this.OF_min ) {
				this.OF_min = OF_current;
			}
			
			// store combination in map
			var mask_string = this.maskToString( this.player_selection_mask );
			this.combinations.set( mask_string, OF_current );
			
			// print detailed info to debug out
			if ( (this.debug_level>=2) && (this.dbg_printed_lines<500) ) {
				this.dbg_printed_lines++;
				this.debugMsg( mask_string, 2 );
				this.dbgPrintCombinationInfoClassic( mask_string );
			}
		};
		
		// filter balanced combinations within OF thresold around minimum and return random one
		this.debugMsg( "best OF = "+this.OF_min );
		this.debugMsg( "stored combinations count = "+this.combinations.size );
		this.debugMsg( "best combinations:" );
		this.balanced_combinations = [];
		for (var [mask_string, OF_value] of this.combinations) {
			if ( (OF_value-this.OF_min) <= this.OF_thresold ) {
				this.balanced_combinations.push( mask_string );
				
				if ( (this.debug_level>=1) && (this.dbg_printed_lines<500) ) {
					this.dbg_printed_lines++;
					this.debugMsg( "#"+(this.balanced_combinations.length-1)+" = "+mask_string, 1 );
					this.dbgPrintCombinationInfoClassic( mask_string );
				}
			}
		}
		
		// clean up bad variants
		this.combinations.clear();
		
		return this.buildRandomBalanceVariantClassic();
	},
	
	buildRandomBalanceVariantClassic: function() {
		this.debugMsg( "best combinations count = "+this.balanced_combinations.length );
		
		if ( this.balanced_combinations.length == 0 ) {
			// no possible balance found
			return false;
		}
		
		// pick random one of best found combinations
		var selected_mask_index = Math.floor(Math.random() * (this.balanced_combinations.length));
		var selected_mask_string = this.balanced_combinations[ selected_mask_index ];		
		this.player_selection_mask = this.maskFromString( selected_mask_string );
		this.debugMsg( "selected combination #"+selected_mask_index+" = "+selected_mask_string );
		this.dbgPrintCombinationInfoClassic( selected_mask_string );
		
		// form teams according to selected mask
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
		
		return true;
	},
	
	balanceTeamsRoleLock: function() {
		//return false;
		
		// init
		this.initPlayerMask();		
		this.OF_min = Number.MAX_VALUE;
		this.combinations.clear();
		var players_combinations = 0;
		var class_combinations_total = 0;
		var class_combinations_valid = 0;
		this.dbg_printed_lines = 0;
		
		var target_players_combinations = factorial(this.team_size*2) / ( factorial(this.team_size) * factorial(this.team_size) );
		this.debugMsg( "target_players_combinations = "+target_players_combinations );
		var previous_progress = 0;
		
		// iterate through all possible player and class combinations and calc objective function (OF)
		// best balanced combinations are with minimum OF value, 0 = perfect
		
		// player combinations loop
		while ( this.findNextPlayerMask() ) {
			if(typeof this.onProgressChange == "function") {
				var current_progress = Math.round( (players_combinations / target_players_combinations)*100 );
				if ( current_progress > previous_progress ) {
					this.onProgressChange.call( undefined, current_progress );
					previous_progress = current_progress;
				}
			}
			
			players_combinations++;
			this.picked_players_team1 = this.pickPlayersByMask( this.player_selection_mask );
			this.picked_players_team2 = this.pickPlayersByMask( this.maskInvert(this.player_selection_mask) );
			
			// iterate through all possible player classes combinations for team 1
			this.class_selection_mask_team1 = Array(this.team_size).fill(0);			
			do {
				if ( ! this.classMaskValid( this.picked_players_team1, this.class_selection_mask_team1 ) ) {
					class_combinations_total++;
					continue;
				}
				
				// iterate through all possible player classes combinations for team 2
				this.class_selection_mask_team2 = Array(this.team_size).fill(0);
				do {
					class_combinations_total++;
					if ( ! this.classMaskValid( this.picked_players_team2, this.class_selection_mask_team2 ) ) {
						continue;
					}
					class_combinations_valid++;
					
					// calc objective function
					var OF_current = this.calcObjectiveFunctionRoleLock();
					
					if ( (OF_current-this.OF_min) > this.OF_thresold ) {
						// trash combination, do not save
						continue;
					}
					
					if ( OF_current < this.OF_min ) {
						this.OF_min = OF_current;
					}
					
					// store combination in map
					var mask_string = this.maskToString(this.player_selection_mask)
										+" "+this.maskToString(this.class_selection_mask_team1)
										+" "+this.maskToString(this.class_selection_mask_team2);
					this.combinations.set( mask_string, OF_current );
					
					// print detailed info to debug out
					if ( (this.debug_level>=2) && (this.dbg_printed_lines<500) ) {
						this.dbg_printed_lines++;
						this.debugMsg( mask_string, 2 );
						this.dbgPrintCombinationInfoRoleLock( mask_string );
					}
				} while ( this.incrementClassMask( this.class_selection_mask_team2 ) );
			} while ( this.incrementClassMask( this.class_selection_mask_team1 ) );
		}
		
		this.debugMsg( "best OF = "+this.OF_min );
		this.debugMsg( "stored combinations count = "+this.combinations.size );
		this.debugMsg( "total player combinations count = "+players_combinations );
		this.debugMsg( "total class combinations count = "+class_combinations_total );
		this.debugMsg( "valid class combinations count = "+class_combinations_valid );
		
		// filter balanced combinations within OF thresold around minimum
		this.debugMsg( "best combinations:", 1 );		
		this.balanced_combinations = [];
		for (var [mask_string, OF_value] of this.combinations) {
			if ( (OF_value-this.OF_min) <= this.OF_thresold ) {
				this.balanced_combinations.push( mask_string );
				
				// dbg info
				if ( (this.debug_level>=1) && (this.dbg_printed_lines<500) ) {
					this.dbg_printed_lines++;
					this.debugMsg( "#"+(this.balanced_combinations.length-1)+" = "+mask_string, 1 );
					this.dbgPrintCombinationInfoRoleLock( mask_string );
				}
			}
		}
		// clean up bad variants
		this.combinations.clear();
		
		return this.buildRandomBalanceVariantRolelock();
	},
	
	
	buildRandomBalanceVariantRolelock: function() {
		this.debugMsg( "best combinations count = "+this.balanced_combinations.length );		
		
		if ( this.balanced_combinations.length == 0 ) {
			// no possible balance found
			return false;
		}
		
		// pick random one of best found combinations		
		var selected_mask_index = Math.floor(Math.random() * (this.balanced_combinations.length));
		var selected_mask_string = this.balanced_combinations[ selected_mask_index ];
		this.debugMsg( "selected combination #"+selected_mask_index+" = "+selected_mask_string );
		this.dbgPrintCombinationInfoRoleLock( selected_mask_string );		
		
		// split masks from string key
		var mask_parts = selected_mask_string.split(" ");
		this.player_selection_mask = this.maskFromString( mask_parts[0] );
		this.class_selection_mask_team1 = this.maskFromString( mask_parts[1] );
		this.class_selection_mask_team2 = this.maskFromString( mask_parts[2] );
		
		// place players to teams and role slots according to masks
		this.picked_players_team1 = this.pickPlayersByMask( this.player_selection_mask );
		this.picked_players_team2 = this.pickPlayersByMask( this.maskInvert(this.player_selection_mask) );
		
		this.team1_slots = this.buildTeamRoleLock( this.picked_players_team1, this.class_selection_mask_team1 );
		this.team2_slots = this.buildTeamRoleLock( this.picked_players_team2, this.class_selection_mask_team2 );		
		
		return true;
	},
	
	
	// mask functions
	
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
	
	initPlayerMask: function () {
		// start at ...00000111110
		this.player_selection_mask = Array(this.players.length - this.team_size).fill(0).concat( Array(this.team_size).fill(1) );
		this.player_selection_mask[this.players.length-1] = 0;
	},
	
	findNextPlayerMask: function() {
		return this.findNextPlayerMaskIncrement();
	},
	
	findNextPlayerMaskIncrement: function() {
		while(true) {
			// binary increment mask
			this.incrementMask( this.player_selection_mask, 2 );			
			
			// check if mask has needed amount of bits
			var bits_count = 0;
			for ( var index = this.player_selection_mask.length - 1; index >=0; index-- ) {
				bits_count += this.player_selection_mask[ index ];
			}
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
	
	// increment mask (array): mask = mask + 1
	// entire mask is handled as number of specified digit base 
	incrementMask: function( mask, digit_base ) {
		var buf = 1;
		for ( var index = mask.length - 1; index >=0; index-- ) {
			buf += mask[ index ];
			mask[ index ] = buf % digit_base;
			buf -= mask[ index ];
			if ( buf == 0 ) {
				break;
			}
			buf = Math.floor( buf / digit_base );
		}
		
		// overflow check
		if ( buf > 0 ) {
			return false;
		}
			
		return true;
	},
	
	incrementClassMask: function( class_selection_mask ) {
		return this.incrementMask( class_selection_mask, class_names.length );
	},
	
	classMaskValid: function(picked_players, class_selection_mask) {
		// object to count classes in mask
		for( var global_class_index=0; global_class_index<class_names.length; global_class_index++ ) {
			this.combination_class_count[global_class_index] = 0;
		}
		
		// count selected classes
		for( var i=0; i<class_selection_mask.length; i++ ) {
			var class_index = class_selection_mask[i];
			// check if player class index is correct
			if ( class_index >= picked_players[i].classes.length ) {
				return false;
			}
			
			var class_name = picked_players[i].classes[class_index];
			var global_class_index = class_names.indexOf(class_name);
			this.combination_class_count[ global_class_index ] ++;
		}
		
		// check if class count equals to slots count
		for( var global_class_index=0; global_class_index<class_names.length; global_class_index++ ) {
			var class_name = class_names[global_class_index];
			if ( this.combination_class_count[global_class_index] != this.slots_count[class_name] ) {
				return false;
			}
		}
		
		return true;
	},
	
	// form array of players by specified mask (array)
	// if mask element (bit) ar index I is 1 - pick player with index I
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
	
	
	// private calculation functions for classic algorithm
	
	
	// objective function (OF) calculation for current players combination
	// objective function is a measure of balance for combination. 
	// smaller value indicates better balanced combination, 0 = perfect balance	
	calcObjectiveFunctionClassic: function( print_debug=false ) {
		// for classic balancer OF is a combined value of 3 factors:
		// 1) difference in teams' average SR
		// 2) difference in amount of players with each class
		// 3) presence of similar 'one trick ponies' in the same team (if enabled)
		// each factor is normalized as SR difference
		// weights of factors 1 and 2 is adjusted by balance_priority_classic
		// factor 3 simply adds huge value if any team has similar one-tricks
		var team1_sr = this.calcTeamSRClassic(this.picked_players_team1);
		var team2_sr = this.calcTeamSRClassic(this.picked_players_team2);
		var sr_diff = Math.abs( team1_sr - team2_sr );
		var class_unevenness = this.calcClassUnevennessClassic( this.picked_players_team1, this.picked_players_team2 );
		var otp_conflicts = 0;
		if (this.separate_otps) {
			otp_conflicts = this.calcOTPConflicts( this.picked_players_team1 ) + this.calcOTPConflicts( this.picked_players_team2 );
		}
		
		var of_value = this.calcObjectiveFunctionValueClassic( sr_diff, class_unevenness, otp_conflicts );
		
		if ( print_debug ) {
			this.debugMsg ( "team1 sr = " + team1_sr + ", team2 sr = " + team2_sr +", sr diff = "+sr_diff+
					", cu = "+class_unevenness+", otp = "+otp_conflicts+", of = "+of_value );
		}
		
		return of_value;
	},
	
	calcObjectiveFunctionValueClassic: function( sr_diff, class_unevenness, otp_conflicts ) {
		var OF = 
			(class_unevenness * this.balance_priority_classic
			+ (sr_diff/this.balance_max_sr_diff*100)*(100-this.balance_priority_classic)
			+ otp_conflicts )
			/100 ;
		return round_to( OF, 1 );
	},
	
	// calculates average team SR
	calcTeamSRClassic: function( team ) {
		var team_sr = 0;
		if (team.length > 0) {
			for( var i=0; i<team.length; i++) {
				var player_sr = team[i].sr;
				player_sr = this.calcPlayerSRClassic( team[i] );
				team_sr += player_sr;
			}
			team_sr = Math.round(team_sr / this.team_size);
		}
		return team_sr;
	},
	
	// calculates player SR with adjusment by class (if enabled)
	calcPlayerSRClassic: function ( player ) {
		var player_sr = get_player_sr( player, this.classic_sr_calc_method );
		if ( this.adjust_sr ) {
			if ( player.classes !== undefined ) {
				var top_class = player.classes[0];
				// @todo why appling only for players with 1 class? o_0
				if( (top_class !== undefined) && (player.classes.length == 1) ) {
					player_sr = Math.round( player_sr * is_undefined(this.adjust_sr_by_class[top_class],100)/100 );
				}
			}
		}
		return player_sr;
	},
	
	// calculates measure of difference in amount of players of each class across teams
	// players with only 1 main class counted as 1 unit
	// players with multiple classes counted as 2/3 units for main class and 1/3 units for each offclass
	// resulting value is normalized as SR difference
	// difference for 1 unit in each class equals to 100 SR difference in average SR
	// 2 units = 400 SR
	// 
	// example 1: 
	//			team 1 = 2 tanks, 1 dps, 3 supports;
	//			team 1 = 2 tanks, 2 dps, 2 supports;
	// class difference = 1+1 units = 200 SR difference
	//
	// example 2: 
	//			team 1 = 2.6 tanks, 2.2 dps, 1.25 supports;
	//			team 1 = 2.25 tanks, 2.25 dps, 1.5 supports;
	// class difference = 0.35 + 0.05 + 0.25 units = 12.3 + 0.3 + 6.3 = 18.9 SR difference
	calcClassUnevennessClassic: function ( team1, team2 ) {
		var class_count = [];
		
		var teams = [team1, team2];
		for ( let t in teams ) {
			var current_class_count = {};
			for( let class_name of class_names ) {
				current_class_count[class_name] = 0;
			}
			
			for( let player of teams[t]) {
				if ( player.classes.length == 2 ) {
					current_class_count[player.classes[0]] += 2/3;
					current_class_count[player.classes[1]] += 1/3;
				} else if ( player.classes.length == 1 ) {
					current_class_count[player.classes[0]] += 1;
				} else if ( player.classes.length == 3 ) {
					current_class_count[player.classes[0]] += 0.5;
					current_class_count[player.classes[1]] += 0.25;
					current_class_count[player.classes[2]] += 0.25;
				}
			}
			
			class_count[t] = current_class_count;
		}
		
		var total_class_unevenness = 0;
		for( let class_name of class_names ) { 
			total_class_unevenness += this.calcClassUnevennessValueClassic( class_count[0][class_name], class_count[1][class_name] ); 
		}
		
		return round_to( total_class_unevenness, 1 );
	},
		
	calcClassUnevennessValueClassic: function ( class_count_1, class_count_2 ) {
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
	
	
	// private calculation functions for role lock algorithm
	
	// objective function (OF) calculation for current players and class combination
	// objective function is a measure of balance for combination 
	// smaller value indicates better balanced combination, 0 = perfect balance
	calcObjectiveFunctionRoleLock: function( print_debug=false ) {
		// for classic balancer OF is a combined value of 3 factors:
		// 1) difference in teams' average SR
		// 2) amount of players sitting on role which is not their main class (i.e. playing on offclass)
		// 3) presence of similar 'one trick ponies' in the same team (if enabled)
		// each factor is normalized as SR difference
		// weights of factors 1 and 2 is adjusted by balance_priority_rolelock
		// factor 3 simply adds huge value if any team has similar one-tricks
		var team1_sr = this.calcTeamSRRoleLock( this.picked_players_team1, this.class_selection_mask_team1 );
		var team2_sr = this.calcTeamSRRoleLock( this.picked_players_team2, this.class_selection_mask_team2 );
		var sr_diff = Math.abs( team1_sr - team2_sr );
		
		var class_mismatch = this.calcClassMismatchRoleLock();
		
		var otp_conflicts = 0;
		if (this.separate_otps) {
			otp_conflicts = this.calcOTPConflicts( this.picked_players_team1 ) + this.calcOTPConflicts( this.picked_players_team2 );
		}
		
		var of_value = this.calcObjectiveFunctionValueRoleLock( sr_diff, class_mismatch, otp_conflicts );
		
		if ( print_debug ) {
			this.debugMsg ( "team1 sr = " + team1_sr + ", team2 sr = " + team2_sr +", sr diff = "+sr_diff+
					", class_mismatch = "+class_mismatch+", otp = "+otp_conflicts+", OF = "+of_value );
		}
		
		return of_value;
	},
	
	calcTeamSRRoleLock: function( team, class_selection_mask ) {
		var team_sr = 0;
		if (team.length > 0) {
			for( var i=0; i<team.length; i++) {
				var slot_class = team[i].classes[ class_selection_mask[i] ];
				var player_sr = this.calcPlayerSRRoleLock( team[i], slot_class );
				team_sr += player_sr;
			}
			team_sr = Math.round(team_sr / this.team_size);
		}
		return team_sr;
	},
	
	// calculates player SR for specified role slot, with adjusment by class (if enabled)
	calcPlayerSRRoleLock: function ( player, class_name ) {
		var player_sr = get_player_sr( player, class_name );
		if ( this.adjust_sr ) {
			player_sr = Math.round( player_sr * is_undefined(this.adjust_sr_by_class[class_name],100)/100 );
		}
		return player_sr;
	},
	
	// calculates measure of players sitting on offroles (not playing their main class)
	// each player player on slot matching his main (first) role = 0 units
	// player player on slot matching his second role = 1 units
	// player player on slot matching his third role = 1.5 units
	// resulting value is normalized as SR difference
	// difference for 1 unit equals to 10 SR difference in average SR
	// 2 units = 40 SR
	// 5 units = 250 SR	
	calcClassMismatchRoleLock: function() {
		var players_on_offclass = 0;
		
		for( var i=0; i<this.picked_players_team1.length; i++) {
			var player_struct = this.picked_players_team1[i];
			var slot_class = player_struct.classes[ this.class_selection_mask_team1[i] ];
			if ( player_struct.classes.indexOf(slot_class) == 1 ) {
				players_on_offclass += 1;
			} else if ( player_struct.classes.indexOf(slot_class) > 1 ) {
				players_on_offclass += 1.5;
			}
		}
		for( var i=0; i<this.picked_players_team2.length; i++) {
			var player_struct = this.picked_players_team2[i];
			var slot_class = player_struct.classes[ this.class_selection_mask_team2[i] ];
			if ( player_struct.classes.indexOf(slot_class) == 1 ) {
				players_on_offclass += 1;
			} else if ( player_struct.classes.indexOf(slot_class) > 1 ) {
				players_on_offclass += 1.5;
			}
		}
		
		return 10 * Math.pow(players_on_offclass, 2);
	},
	
	calcObjectiveFunctionValueRoleLock: function( sr_diff, class_mismatch, otp_conflicts ) {
		var OF = 
			(class_mismatch * this.balance_priority_rolelock
			+ (sr_diff/this.balance_max_sr_diff*100)*(100-this.balance_priority_rolelock)
			+ otp_conflicts )
			/100 ;
		return round_to( OF, 1 );
	},
	
	// creates team structure with players on specified classes/roles
	buildTeamRoleLock: function ( team, class_selection_mask ) {
		var slots = {};
		init_team_slots( slots );
		for( var i=0; i<team.length; i++) {
			var slot_class = team[i].classes[ class_selection_mask[i] ];
			slots[ slot_class ].push( team[i] );
		}
		
		// sort players by sr in each role
		for( let class_names in this.slots_count ) {
			slots[ class_names ].sort( function(player1, player2){
				var val1 = get_player_sr( player1, class_names );
				var val2 = get_player_sr( player2, class_names );
				return val2 - val1;
			} );
		}
		
		return slots;
	},
	
	
	// build string representing all balancer settings and players
	getBalancerStateString: function() {
		// create temporary object with all data affecting balance calculation
		// and copy data from this
		var tmp_obj = {};
		
		// list of properies affecting balance calculations
		var balance_properties = [			
			"slots_count",
			"algorithm",
			"separate_otps",
			"adjust_sr",
			"adjust_sr_by_class",
			"OF_thresold",
			"classic_sr_calc_method",
			"balance_priority_classic",
			"balance_priority_rolelock",
			"balance_max_sr_diff",
		];
		for ( let property_name of balance_properties ) {
			tmp_obj[property_name] = this[property_name];
		}
		
		// copy players
		tmp_obj.players = [];
		for (let player of this.players) {
			tmp_obj.players.push( player );
		}		
			
		// convert obj to string
		var data_string = JSON.stringify(tmp_obj, null, null);
		return data_string;
	},
	
	// debug functions
	
	debugMsg: function ( msg, msg_debug_level=0 ) {
		if ( this.roll_debug && (msg_debug_level<=this.debug_level) ) {
			if(typeof this.onDebugMessage == "function") {					
				this.onDebugMessage.call( undefined, msg );
			}
		}
	},
	
	dbgPrintCombinationInfoClassic: function( mask_string ) {
		if ( this.roll_debug ) {
			if(typeof this.onDebugMessage == "function") {
				this.player_selection_mask = this.maskFromString( mask_string );
				this.picked_players_team1 = this.pickPlayersByMask( this.player_selection_mask );
				this.picked_players_team2 = this.pickPlayersByMask( this.maskInvert(this.player_selection_mask) );
				
				var picked_players_string = "{ ";
				for( var i=0; i<this.picked_players_team1.length; i++ ) {
					picked_players_string += this.picked_players_team1[i].id;
					picked_players_string += ", ";
				}
				picked_players_string += " }";
				this.onDebugMessage.call( undefined, "team1 = " + picked_players_string);
				
				var picked_players_string = "{ ";
				for( var i=0; i<this.picked_players_team2.length; i++ ) {
					picked_players_string += this.picked_players_team2[i].id;
					picked_players_string += ", ";
				}
				picked_players_string += " }";
				this.onDebugMessage.call( undefined, "team2 = " + picked_players_string);
				
				var OF_current = this.calcObjectiveFunctionClassic( true );
				this.onDebugMessage.call( undefined, "OF = " + OF_current);
			}
		}
	},
	
	dbgPrintCombinationInfoRoleLock: function( mask_string ) {
		if ( this.roll_debug ) {
			if(typeof this.onDebugMessage == "function") {
				var mask_parts = mask_string.split(" ");
				this.player_selection_mask = this.maskFromString( mask_parts[0] );
				this.picked_players_team1 = this.pickPlayersByMask( this.player_selection_mask );
				this.picked_players_team2 = this.pickPlayersByMask( this.maskInvert(this.player_selection_mask) );
				this.class_selection_mask_team1 = this.maskFromString( mask_parts[1] );
				this.class_selection_mask_team2 = this.maskFromString( mask_parts[2] );
				
				var picked_players_string = "{ ";
				for( var i=0; i<this.picked_players_team1.length; i++ ) {
					picked_players_string += this.picked_players_team1[i].id;
					picked_players_string += "=";
					picked_players_string += this.picked_players_team1[i].classes[ this.class_selection_mask_team1[i] ];
					picked_players_string += ", ";
				}
				picked_players_string += " }";
				this.onDebugMessage.call( undefined, "team1 = " + picked_players_string);
				
				var picked_players_string = "{ ";
				for( var i=0; i<this.picked_players_team2.length; i++ ) {
					picked_players_string += this.picked_players_team2[i].id;
					picked_players_string += "=";
					picked_players_string += this.picked_players_team2[i].classes[ this.class_selection_mask_team2[i] ];
					picked_players_string += ", ";
				}
				picked_players_string += " }";
				this.onDebugMessage.call( undefined, "team2 = " + picked_players_string);
				
				var OF_current = this.calcObjectiveFunctionRoleLock( true );
				this.onDebugMessage.call( undefined, "OF = " + OF_current);
			}
		}
	},
}


// Algorithm testing
//
// Role Lock algorithm:
// total possible combinations count = (player combination count) * (class combination count)
// player combination count = (team_size*2)! / ( (team_size)! * ((team_size*2)−(team_size))! )
//							= (team_size*2)! / ( (team_size)! * (team_size)! )
// for 6 * 6 teams 
// player combination count = 6! / ( 6! * (12-6)! ) = 924
// class combination count depends on players' class count
// valid combination count (where OF will be calculated) also depends on slots.
// 
// Worst case scenario (all players have 3 active classes, 2-2-2 slots):
// class combination count = 3^6 * 3^6 = 729 * 729 = 531 441
// total possible combinations count = 924 * 531 441 = 491 051 484
//
// Some real cases benchmarks (Firefox 60 32bit, Core i5 6500):
// initial code version, no optimisations
// 6*6 teams, 2-2-2 slots
// total combinations = 3M, valid combinations = 7K = 0.7 seconds
// total combinations = 6M, valid combinations = 39K = 1.6 seconds
// total combinations = 8M, valid combinations = 91K = 2.6 seconds
// total combinations = 12M, valid combinations = 164K = 4.5 seconds
// total combinations = 19M, valid combinations = 500K = 9.1 seconds
// total combinations = 30M, valid combinations = 1572K = 23.4 seconds
// total combinations = 35M, valid combinations = 2222K = 31.0 seconds
// worst case - all players have 3 classes:
// total combinations = 61M, valid combinations = 7484K = 90.9 seconds
//
// Chrome 76 64bit, Core i5 6500
// total combinations = 61M, valid combinations = 7484K = 53.5 seconds
//
//---------------------------------------
//
// Optimization tests for role lock algorithm
// Chrome 76 64bit, Core i5 6500
//
// total combinations = 8M, valid combinations = 58K
// initial code = 1750 ms
// + global class count obj in classMaskValid = 1750 ms
// + global array for class count instead of obj in classMaskValid = 1135 ms
// + class mask increment break on buf=0 	= 550 ms
// + do not store trash combinations in map = 520 ms
//
// total combinations = 61M, valid combinations = 7484K
// all optimisations = 35.8 seconds
