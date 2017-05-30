# Overwatch custom game balancer
Tool for balancing teams in Overwatch custom games.

[Live version on GitHub Pages](https://adminimusru.github.io/OWcustomBalancer/index.html)

## Features:
  * Advanced auto balancing algorithm:
    * Balancing teams by average SR and/or player's classes/roles to prevent undesirable compositions (like 5 supports in one team);
    * Adjustable value of balancing factors (SR and classes);
    * Options to tweak value of different classes to account different gameplay impact;
    * Option to mark players as team captains (will not be moved by balancer);
    * Option to handle one-trick ponies;
  * Automatic calculation of team's average SR for manual balancing;
  * Page URL contains current team setup and can be shared;
  * New players added by BattleTag, all stats (current competitive SR, level, most played heroes and roles/classes) are automatically acquired via [OWAPI](https://github.com/SunDwarf/OWAPI);
  * Lobby used to store any amount of players (limited only by browser storage size);
  * Player list import and export in JSON (with stats) and plain text (only BattleTags) formats;
  * Quick search for players in lobby by name or BattleTag;
  * All added players and settings automatically saved in browser storage;
  * Multiple ways to move players between lobby and teams:
    * Select and swap;
    * Drag & drop;
    * Double click (auto move);
  * Adjustable team size (3x3, 6x6 or any custom size);
  * Player nickname, SR and class can be edited manually (right click on player);
  * Editable team names;
  * Stats can be updated for all players in one click or for specific player only;
    * Options for update only selected fields and exclude manually edited fields;
  * Region selection for stats (EU, US, KR).
