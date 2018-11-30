var class_names = [
	"tank",
	"dps",
	"support"
];

var hero_classes = {
	reaper:		"dps",
	pharah:		"dps",
	soldier76:	"dps",
	genji:		"dps",
	tracer:		"dps",
	sombra:		"dps",
	mccree:		"dps",
	doomfist:	"dps",
	ashe:		"dps",
	
	torbjorn:	"dps",
	hanzo:		"dps",
	mei:		"dps",
	bastion:	"dps",
	widowmaker:	"dps",
	junkrat:	"dps",
	
	symmetra:	"dps",
	
	mercy:		"support",
	ana:		"support",
	lucio:		"support",
	zenyatta:	"support",
	moira:		"support",
	brigitte:	"support",
	
	dva:		"tank",
	orisa:		"tank",
	winston:	"tank",
	zarya:		"tank",
	roadhog:	"tank",
	reinhardt:	"tank",
	wrecking_ball:"tank",
};

var ow_ranks = {
	"unranked":		{ min: 0, max: 0 },
	"bronze":		{ min: 1, max: 1499 },
	"silver":		{ min: 1500, max: 1999 },
	"gold":			{ min: 2000, max: 2499 },
	"platinum":		{ min: 2500, max: 2999 },
	"diamond":		{ min: 3000, max: 3499 },
	"master":		{ min: 3500, max: 3999 },
	"grandmaster":	{ min: 4000, max: 4399 },
	"top500":		{ min: 4400, max: 5000 },
};
