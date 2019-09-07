/*
*		Global variables
*/

var lobby = [];

// // players in teams (flat array) - for classic balancer
var team1 = [];
var team2 = [];

// players in teams by roles - for role locked balancer
var team1_slots = {};
var team2_slots = {};

// id's of pinned players. Those are not moving to lobby when team is cleared
var pinned_players = new Set();

// id's of checked-in players
var checkin_list = new Set();

// reference to temporary empty player object for new added player for loading stats
var player_being_added;
// reference to player object for edit dialog
var player_being_edited;

// timer for applying lobby filter on user input
var lobby_filter_timer = 0;

// global settings object
var Settings = {};
const storage_prefix = "owcgb_";

var ExportOptions = {};

// class icons in data:url strings
var class_icons_datauri = {};
var rank_icons_datauri = {};