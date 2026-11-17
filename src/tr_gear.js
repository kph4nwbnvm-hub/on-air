// Registers the translated equipment names (one file per language, added in batches).
import { addGear } from './gearnames.js';
import zhHans from './tr_gear_zh-Hans.js';
import es from './tr_gear_es.js';
addGear('zh-Hans', zhHans); addGear('es', es);
