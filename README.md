# Overwatch custom game balancer
Tool for balancing teams in Overwatch custom games.

[Live version on GitHub Pages](https://adminimusru.github.io/OWcustomBalancer/index.html)

## Features:
  * New players added by BattleTag, all stats (current competitive SR, level, most played roles/classes) are automatically acquired via [OWAPI](https://github.com/SunDwarf/OWAPI);
  * Lobby used to store any amount of players (limited only by browser storage size);
  * Multiple ways to move players between lobby and teams:
    * Select and swap;
    * Drag & drop;
    * Double click (auto move);
  * Adjustable team size (3x3, 6x6 or any custom size);
  * Player nickname, SR and class can be edited manually;
  * Stats can be updated for all players in one click;
    * Options for update only selected fields and exclude manually edited fields;
  * Region selection for stats;
  * All added players and settings automatically saved in browser storage;
  * Player list import and export in JSON and plain text formats;
  * Team balancer can take into account player's classes/roles to prevent undesirable compositions (like 5 supports in one team);
  * Options to tweak value of different classes to account different gameplay impact;
  * Team names are editable;
  * Quick search for players in lobby by name or BattleTag.
