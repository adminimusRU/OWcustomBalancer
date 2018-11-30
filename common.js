function array_shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

function apply_stats_updater_settings() {
	StatsUpdater.update_edited_fields = Settings.update_edited_fields;
	StatsUpdater.update_sr = Settings.update_sr;
	StatsUpdater.update_class = Settings.update_class;
	StatsUpdater.region = Settings.region;
}

function b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function calc_team_sr( team ) {
	var team_sr = 0;
	if (team.length > 0) {
		for( var i=0; i<team.length; i++) {
			var player_sr = team[i].sr;
			team_sr += player_sr;
		}
		team_sr = Math.round(team_sr / Settings.team_size);
	}
	return team_sr;
}

function create_empty_player() {
	return {
			id: "",
			display_name: "",
			sr: 0,
			empty: true,
			level: 0,
			top_classes: [],
			top_heroes: [],
			last_updated: new Date(0),
			private_profile: false,
		};
}

function create_random_player( id ) {
	var classes = class_names.slice();
	var top_classes = [];
	top_classes.push( classes.splice( Math.round(Math.random()*(classes.length-1)), 1 )[0] );
	if( Math.random() > 0.4 ) {
		top_classes.push( classes[ Math.round(Math.random()*(classes.length-1)) ] );
	}
	var top_heroes = [];
	return {
			id: "player"+id+"-"+Math.round(Math.random()*99999),
			display_name: "player "+id,
			sr: Math.round( randn_bm( 1, 4999, 1) ),
			level: Math.round(Math.random()*2000),
			empty: false,
			top_classes: top_classes,
			top_heroes: top_heroes,
			last_updated: new Date(0),
			fake_id: true,
			private_profile: false
		};
}

function escapeHtml(html){
	var text_node = document.createTextNode(html);
	var p = document.createElement('p');
	p.appendChild(text_node);
	return p.innerHTML;
}

function find_player_by_id(player_id) {
	for( var i=0; i<lobby.length; i++) {
		if ( player_id == lobby[i].id) {
			return lobby[i];
		}
	}

	for ( const team of [team1, team2] ) {
		for( var i=0; i<team.length; i++) {
			if ( player_id == team[i].id) {
				return team[i];
			}
		}
	}
	return undefined;
}

function format_player_id( id ) {
	return id.trim().replace("#", "-");
}

function format_player_name( id ) {
	return id.slice( 0, id.search("-") );
}

function get_default_settings() {
	return {
		team_size: 6,
		
		adjust_sr: false,
		adjust_dps: 110,
		adjust_tank: 100,
		adjust_support: 90,
		balance_priority: 50,
		separate_otps: true,
		
		region: "eu",
		update_class: true,
		update_sr: true,
		update_edited_fields: false,
		update_picked: true,
		update_picked_maxage: 15,
	};
}

function get_default_export_options() {
	return {
		format: "image",
		include_sr: true,
		include_classes: true,
	}
}

function get_player_index( player_id, team ) {
	for( var i=0; i<team.length; i++) {
		if ( player_id == team[i].id) {
			return i;
		}
	}
	
	return -1;
}

function get_rank_name( sr ) {
	for ( const rank_name in ow_ranks ) {
		if ( (sr >= ow_ranks[rank_name].min) && (sr <= ow_ranks[rank_name].max) ) {
			return rank_name;
		}
	}
	return "unranked";
}

function get_scrollbar_width() {
	var outer = document.createElement("div");
	outer.style.visibility = "hidden";
	outer.style.width = "100px";
	outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

	document.body.appendChild(outer);

	var widthNoScroll = outer.offsetWidth;
	// force scrollbars
	outer.style.overflow = "scroll";

	// add innerdiv
	var inner = document.createElement("div");
	inner.style.width = "100%";
	outer.appendChild(inner);        

	var widthWithScroll = inner.offsetWidth;

	// remove divs
	outer.parentNode.removeChild(outer);

	return widthNoScroll - widthWithScroll;
}

function is_undefined( expr, if_undefined ) {
	if( typeof expr === "undefined" ) {
		return if_undefined;
	} else {
		return expr;
	}
}

function print_date( date_value ) {
	if( typeof date_value === "undefined" ) {
		return "-";
	} else if (date_value.getTime() == 0) {
		return "-";
	} else {
		return date_value.toLocaleString();
	}
}

// random number with normal distribution ("bell curve")
// using Box–Muller transform
function randn_bm(min, max, skew=1) {
	var u = 0, v = 0;
	while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
	while(v === 0) v = Math.random();
	let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

	num = num / 10.0 + 0.5; // Translate to 0 -> 1
	if (num > 1 || num < 0) num = randn_bm(min, max, skew); // resample between 0 and 1 if out of range
	num = Math.pow(num, skew); // Skew
	num *= max - min; // Stretch to fill range
	num += min; // offset to min
	return num;
}

function round_to( value, precision ) {
	return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
}

function sort_players( team, sort_field = 'sr' ) {
	if ( sort_field == 'class' ) {
		team.sort( function(player1, player2){
				var val1 = -1;
				if (player1.top_classes.length > 0) {
					val1 = 10 * (class_names.indexOf( player1.top_classes[0] )+1);
				}
				if (player1.top_classes.length > 1) {
					val1 += class_names.indexOf( player1.top_classes[1] ) + 1;
				}
				var val2 = -1;
				if (player2.top_classes.length > 0) {
					val2 = 10 * (class_names.indexOf( player2.top_classes[0] )+1);
				}
				if (player2.top_classes.length > 1) {
					val2 += class_names.indexOf( player2.top_classes[1] ) + 1;
				}
				return val1 - val2;
			} );
	} else {
		team.sort( function(player1, player2){
				if( typeof player1[sort_field] === 'string') {
					var val1 = player1[sort_field].toLowerCase();
					var val2 = player2[sort_field].toLowerCase();
					return ( val1<val2 ? -1 : (val1>val2?1:0) );
				} else { 
					return player2[sort_field] - player1[sort_field];
				} 
			} );
	}
}

function str_padding( source_str, length, padding_char=" " ) {
	var result = source_str;
	while ( result.length < length ) {
		result += padding_char;
	}
	return result;
}
