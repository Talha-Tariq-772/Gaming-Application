-- Part B (game detail page rebuild): no seeded game had a description, so
-- the detail page's description section always rendered as dead space
-- below the purchase block. One or two factual sentences per game — genre
-- and premise only, nothing about pricing, release dates (already a
-- separate column), or plot specifics beyond what's publicly known about
-- each title. Memberships (playstation-plus, ps-plus-extra-premium,
-- xbox-game-pass-ultimate) are untouched — they're a different
-- product_type with their own page, not this migration's concern.

update games set description = 'An open-world action RPG following Eivor, a Viking raider leading their clan from Norway to England during the Viking Age.' where slug = 'assassins-creed-valhalla';

update games set description = 'A large-scale military shooter built around all-out multiplayer warfare and destructible environments.' where slug = 'battlefield-6';

update games set description = 'An action RPG inspired by the classic Chinese novel Journey to the West, casting you as the Destined One battling mythical foes across a richly realized world.' where slug = 'black-myth-wukong';

update games set description = 'The latest Black Ops entry in the Call of Duty series, featuring a new campaign, multiplayer, and Zombies mode.' where slug = 'cod-black-ops-6';

update games set description = 'A high-stakes military shooter following Task Force 141 against a dangerous global threat, with acclaimed multiplayer and co-op modes.' where slug = 'cod-modern-warfare-2';

update games set description = 'A first-person action game set in a zombie-overrun Los Angeles, known for its visceral melee combat.' where slug = 'dead-island-2';

update games set description = 'An arena fighting game bringing Dragon Ball''s biggest battles to life with a large roster of characters and destructible stages.' where slug = 'dragon-ball-sparking-zero';

update games set description = 'EA Sports'' football simulation, featuring licensed clubs, leagues, and players from around the world.' where slug = 'fc-26';

update games set description = 'The latest entry in EA Sports'' football simulation series, with updated rosters and refined gameplay.' where slug = 'fc-27';

update games set description = 'Sucker Punch''s open-world samurai action game set in feudal Japan, following a new protagonist on a path around Mount Yotei.' where slug = 'ghost-of-yotei';

update games set description = 'Rockstar Games'' next open-world crime saga, returning to a reimagined Vice City with dual protagonists Lucia and Jason.' where slug = 'gta-vi';

update games set description = 'An open-world action RPG set in the wizarding world during the 1800s, letting you attend Hogwarts and master spellcasting.' where slug = 'hogwarts-legacy';

update games set description = 'An open-world superhero game starring both Peter Parker and Miles Morales as they swing across New York to stop a new threat.' where slug = 'spider-man-2';

update games set description = 'An open-world street racing game blending realistic driving with a stylized, graffiti-inspired art style.' where slug = 'need-for-speed-unbound';

update games set description = 'A third-person survival shooter with soulslike elements, sending you through procedurally-assembled worlds against monstrous enemies.' where slug = 'remnant-2';

update games set description = 'A survival horror remake following James Sunderland as he searches the fog-shrouded town of Silent Hill for his deceased wife.' where slug = 'silent-hill-2';
