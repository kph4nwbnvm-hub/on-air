// Registers the translated equipment names (one file per language, added in batches).
import { addGear } from './gearnames.js';
import g_pt from './tr_gear_pt.js';
import g_ru from './tr_gear_ru.js';
import g_id from './tr_gear_id.js';
import g_bn from './tr_gear_bn.js';
import g_de from './tr_gear_de.js';
import g_ja from './tr_gear_ja.js';
import g_vi from './tr_gear_vi.js';
import g_tr from './tr_gear_tr.js';
import zhHans from './tr_gear_zh-Hans.js';
import es from './tr_gear_es.js';
import fr from './tr_gear_fr.js';
import hi from './tr_gear_hi.js';
addGear('zh-Hans', zhHans); addGear('tr', g_tr); addGear('vi', g_vi); addGear('ja', g_ja); addGear('de', g_de); addGear('bn', g_bn); addGear('id', g_id); addGear('ru', g_ru); addGear('pt', g_pt); addGear('es', es); addGear('fr', fr); addGear('hi', hi);
