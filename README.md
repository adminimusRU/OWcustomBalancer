# Overwatch custom game balancer
Tool for balancing teams in Overwatch custom games.

[Live version on GitHub Pages](https://adminimusru.github.io/OWcustomBalancer/index.html)

## Features:
  * Advanced auto balancing algorithm:
    * Balancing teams by average SR and player's classes/roles to prevent undesirable compositions (like 5 supports in one team);
    * Adjustable priority of balancing factors (SR and classes);
    * Tweakable average SR calculation depending on player's main class to reflect different gameplay impact;
    * Separation of similar one-trick ponies;
  * Automatic calculation of team's average SR for manual balancing;
  * New players are added by BattleTag, all stats (current competitive SR, level, most played heroes and roles/classes) are automatically acquired via [OWAPI](https://github.com/SunDwarf/OWAPI);
  * Lobby used to store any amount of players (limited only by browser storage size);
  * Player list import and export in JSON and text formats;
  * Team composition export in text, HTML and image formats;
  * Quick search for players in lobby by name or BattleTag;
  * Player sorting by name, SR or class;
  * All added players and settings automatically saved in browser storage;
  * Multiple ways to move players between lobby and teams:
    * Drag & drop;
    * Double click (auto move to empty slot);
  * Adjustable team size (3x3, 6x6 or any custom size);
  * Player nickname, SR and class can be edited manually (right click on player);
  * Editable team names;
  * Stats can be updated for all players in one click or for specific player only;
    * Options for update only selected fields and exclude manually edited fields;
  * Outdated stats automatically updated on player transfer;
  * Region selection for stats (EU, US, KR).
