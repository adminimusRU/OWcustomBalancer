// OWAPI interface object
// usage: 
// 1. set id to player BattleTag
// 2. set onSuccess and onFail callback functions
// 3. call getStats() method
// 4. object field filled with stats. Read them in onSuccess callback or process error in onFail
var OWAPI = {
	id: "", // player battletag
	display_name: "", // first part of battletag before '#'
	sr: 0,
	level: 0,
	time_played: 0,
	top_classes: [],
	top_heroes: [],
	private_profile: false,
	
	onSuccess: undefined, // Set to actual callback function before use
	onFail: undefined, // Set to actual callback function before use
	
	can_retry: false, // will be set to true on "soft" errors (like timeouts)
	
	// settings
	owapi_timeout: 15000, // 15 sec timeout for OWAPI requests
	top_class_min_fraction: 0.25, // fraction of overall time played
	top_hero_max_ratio: 4.0, // ratio of hero playtime to detect top heroes
	region: "eu", // us, kr
	
	// internal
	is_processed: false, // to prevent multiple callback on single request
	
	// public methods
	
	getStats: function() {
		// reset
		this.sr = 0;
		this.level = 0;
		this.time_played = 0;
		this.top_classes = [];
		this.top_heroes = [];
		this.private_profile = false;
		
		this.id = format_player_id( this.id );
		this.display_name = format_player_name( this.id );
		
		this.is_processed = false;
	
		var xhttp = new XMLHttpRequest();
		xhttp.onload = function() {
			if (this.readyState == 4 ) {
				if ( this.status == 200) {
					try {
						var stats_obj = JSON.parse(this.responseText);
						if ( stats_obj[OWAPI.region] === null ) {	
							OWAPI.can_retry = false;
							throw new Error("Player has no stats in region "+OWAPI.region.toUpperCase());
						}
						if ( stats_obj[OWAPI.region].stats.competitive !== null ) {
							if ( ! stats_obj[OWAPI.region].stats.competitive.hasOwnProperty('overall_stats') ) {
								OWAPI.can_retry = false;
								throw new Error("Player has no stats in region "+OWAPI.region.toUpperCase());
							}
							OWAPI.sr = Number(stats_obj[OWAPI.region].stats.competitive.overall_stats.comprank);
							
							OWAPI.level = stats_obj[OWAPI.region].stats.competitive.overall_stats.prestige*100 + stats_obj[OWAPI.region].stats.competitive.overall_stats.level,
							OWAPI.time_played = Number(stats_obj[OWAPI.region].stats.competitive.game_stats.time_played);
							
							var hero_stats = OWAPI.parseHeroStats( stats_obj[OWAPI.region].heroes );
							OWAPI.top_classes = OWAPI.calculateTopClasses( hero_stats );
							OWAPI.top_heroes = OWAPI.calculateTopHeroes( hero_stats );
						} 
						
						if (typeof OWAPI.onSuccess == "function") {
							if ( ! OWAPI.is_processed ) {
								OWAPI.onSuccess.call();
							}
							OWAPI.is_processed = true;
						}
					}
					catch (err) {
						if(typeof OWAPI.onFail == "function") {
							if ( ! OWAPI.is_processed ) {
								OWAPI.onFail.call( OWAPI, err.message );
							}
							OWAPI.is_processed = true;
						}
					}
						
				} else {
					var msg = "";
					switch (this.status) {
						case 404: msg = "Player not found (incorrect BattleTag)";
									OWAPI.can_retry = false;
									break;
						case 429: msg = "Too many stats requests, try later";
									OWAPI.can_retry = true;
									break;
						case 403: msg = "Player has private profile";
									OWAPI.can_retry = false;
									OWAPI.private_profile = true;
									break;
						default: msg = "Can't get player stats (HTTP "+this.status+": "+this.statusText+")";
									OWAPI.can_retry = true;
					}
					if(typeof OWAPI.onFail == "function") {
						if ( ! OWAPI.is_processed ) {
							OWAPI.onFail.call( OWAPI, msg );
						}
						OWAPI.is_processed = true;
					}
				}
			}
		};
		xhttp.ontimeout = function() {
			var msg = "OWAPI timeout";
			OWAPI.can_retry = true;
			if(typeof OWAPI.onFail == "function") {
				if ( ! OWAPI.is_processed ) {
					OWAPI.onFail.call( OWAPI, msg );
				}
				OWAPI.is_processed = true;
			}
		};
		
		xhttp.onerror = function() {
			var msg = "OWAPI error - "+this.statusText;
			if(typeof OWAPI.onFail == "function") {
				if ( ! OWAPI.is_processed ) {
					OWAPI.onFail.call( OWAPI, msg );
				} 
				OWAPI.is_processed = true;
			}
		};
		
		xhttp.open("GET", "https://owapi.net/api/v3/u/"+this.id+"/blob", true);
		xhttp.timeout = OWAPI.owapi_timeout;
		xhttp.send();
	},
	
	// private methods
	
	// returns array of objects (hero, playtime) sorted by playtime
	parseHeroStats: function( heroes_node ) {
		var hero_playtime = heroes_node.playtime.competitive;
		
		var hero_playtime_sorted = [];
		for (var hero_name in hero_playtime ) {
			var current_hero_playtime = Math.round(hero_playtime[hero_name] * 100) / 100;
			hero_playtime_sorted.push( { hero: hero_name, playtime: current_hero_playtime} );
		}
		
		hero_playtime_sorted.sort( function(hero1, hero2) {
				return hero2.playtime - hero1.playtime;
			});
			
		return hero_playtime_sorted;
	},
	
	// returns top 2 hero classes
	calculateTopClasses: function calculate_top_classes( hero_playtime ) {
		var class_playtime = {
			dps: 0,
			tank: 0,
			support: 0
			};
		
		var total_hero_playtime = 0;
		for ( i=0; i<hero_playtime.length; i++ ) {
			var hero_class = hero_classes[hero_playtime[i].hero];
			if ( hero_class === undefined ) {
				throw new Error("Unknown hero: "+hero_playtime[i].hero);
			}
			class_playtime[hero_class] += hero_playtime[i].playtime;
			total_hero_playtime += hero_playtime[i].playtime;
		}
		
		if ( total_hero_playtime == 0 ) {
			return [];
		}
		
		var class_playtime_arr = Object.entries(class_playtime);
		class_playtime_arr.sort( function(item1, item2){
				return item2[1]-item1[1];	
			});
		
		var top_classes = [];
		var top_class = class_playtime_arr.shift();
		if( top_class !== undefined ) {
			top_classes.push( top_class[0] );
		}
		top_class = class_playtime_arr.shift();
		if( top_class !== undefined ) {
			if( Number(top_class[1])/this.time_played >= OWAPI.top_class_min_fraction ) {
				top_classes.push( top_class[0] );
			}
		}
		
		return top_classes;
	},
	
	// returns top 4 heroes by playtime
	calculateTopHeroes: function ( hero_playtime ) {
		var top_heroes = [];
		if ( hero_playtime.length != 0 ) {
			top_heroes.push( hero_playtime[0] );
		}
		
		for ( i=1; i<hero_playtime.length; i++ ) {
			if (  hero_playtime[i-1].playtime / hero_playtime[i].playtime < OWAPI.top_hero_max_ratio ) {
				top_heroes.push( hero_playtime[i] );
			} else {
				break;
			}
		}
			
		while (top_heroes.length > 4) {
			top_heroes.pop();
		}
		
		return top_heroes;
	}
}
