// Registers the translated equipment names (one file per language, added in batches).
import { addGear } from './gearnames.js';
import zhHans from './tr_gear_zh-Hans.js';
import es from './tr_gear_es.js';
import fr from './tr_gear_fr.js';
import hi from './tr_gear_hi.js';
addGear('zh-Hans', zhHans); addGear('es', es); addGear('fr', fr); addGear('hi', hi);
