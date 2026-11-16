// 15 levels for every store family. Broadcast gear follows its real history (era + connector);
// other families follow a quality/technology ladder. Low levels have flaws; top levels add AI.
// Level entry: [arabic, english, era, connector]. Connector is null when no hub is needed.
export const MAX_LV = 15;

const T = {
  camera: [
    ['كاميرا أيقونوسكوب ميكانيكية', 'Iconoscope camera', '1930s', 'rca'], ['كاميرا أورثيكون بالأبيض والأسود', 'Image-orthicon B/W camera', '1950s', 'rca'],
    ['كاميرا ملونة بأنابيب', 'Colour tube camera', '1960s', 'rca'], ['كاميرا أخبار محمولة ENG', 'ENG news camera', '1970s', 'rca'],
    ['كاميرا بيتاكام', 'Betacam camcorder', '1980s', 'rca'], ['كاميرا رقمية DigiBeta', 'Digital Betacam', '1990s', 'sdi'],
    ['كاميرا HD للبث', 'HD broadcast camera', '2000s', 'sdi'], ['كاميرا DSLR فيديو', 'DSLR video camera', '2008', 'hdmi'],
    ['كاميرا سينمائية 4K', '4K cinema camera', '2012', 'sdi'], ['كاميرا ميرورلس 4K', '4K mirrorless camera', '2016', 'hdmi'],
    ['كاميرا PTZ شبكية', 'Network PTZ camera', '2018', 'ethernet'], ['كاميرا 8K بالألياف', '8K fibre camera', '2020', 'fiber'],
    ['كاميرا بتتبع ذكي', 'AI auto-tracking camera', '2023', 'ethernet'], ['كاميرا مخرج ذكي', 'AI director camera', '2025', 'wireless'],
    ['كاميرا هولوغرام ذكية', 'Holographic AI camera', 'future', 'wireless']],
  mic: [
    ['مايك كربوني', 'Carbon microphone', '1920s', 'trs'], ['مايك شريطي', 'Ribbon microphone', '1930s', 'trs'], ['مايك مكثف بصمام', 'Tube condenser', '1940s', 'xlr'],
    ['مايك ديناميكي', 'Dynamic microphone', '1950s', 'xlr'], ['مايك لاقط صغير', 'Electret lavalier', '1970s', 'xlr'], ['مايك لاسلكي تناظري', 'Analogue wireless mic', '1980s', 'xlr'],
    ['مايك استوديو مكثف', 'Studio condenser', '1990s', 'xlr'], ['مايك USB للبودكاست', 'USB podcast mic', '2005', 'usbc'], ['مايك لاسلكي رقمي', 'Digital wireless mic', '2010', 'wireless'],
    ['مايك شبكي Dante', 'Dante network mic', '2014', 'ethernet'], ['مصفوفة مايكات موجّهة', 'Beamforming array', '2018', 'ethernet'], ['مايك 32-bit عائم', '32-bit float mic', '2021', 'usbc'],
    ['مايك بإزالة ضوضاء ذكية', 'AI noise-removal mic', '2023', 'wireless'], ['مايك بوضوح صوت ذكي', 'AI voice-clarity mic', '2025', 'wireless'], ['مايك عصبي مستقبلي', 'Neural future mic', 'future', 'wireless']],
  light: [
    ['قوس كربوني', 'Carbon arc lamp', '1900s', null], ['كشاف فرينل متوهج', 'Incandescent Fresnel', '1930s', null], ['كشاف هالوجين', 'Tungsten-halogen', '1960s', null],
    ['كشاف HMI', 'HMI daylight', '1970s', null], ['لوحة DMX فلورسنت', 'DMX fluorescent bank', '1986', 'dmx'], ['كشاف متحرك', 'Moving head', '1990s', 'dmx'],
    ['لوحة LED', 'LED panel', '2005', 'dmx'], ['LED ثنائي اللون', 'Bi-colour LED', '2010', 'dmx'], ['LED كامل الألوان', 'Full-colour RGBWW', '2014', 'dmx'],
    ['إضاءة DMX لاسلكية', 'Wireless DMX light', '2016', 'wireless'], ['أنبوب LED بكسلي', 'Pixel LED tube', '2018', 'wireless'], ['إضاءة شبكية Art-Net', 'Art-Net network light', '2020', 'ethernet'],
    ['إضاءة تتبع ذكية', 'AI follow light', '2023', 'wireless'], ['إضاءة مشهد ذكية', 'AI scene lighting', '2025', 'wireless'], ['ضوء حجمي مستقبلي', 'Volumetric future light', 'future', 'wireless']],
  mixer: [
    ['مكسر صمامات', 'Valve mixer', '1930s', null], ['طاولة بث إذاعي', 'Broadcast console', '1950s', null], ['مكسر ترانزستور', 'Transistor mixer', '1960s', null],
    ['طاولة متعددة المسارات', 'Multitrack desk', '1970s', null], ['طاولة بأتمتة', 'Automated console', '1980s', null], ['مكسر رقمي', 'Digital mixer', '1990s', null],
    ['مكسر بواجهة USB', 'USB interface mixer', '2005', null], ['مكسر رقمي شبكي', 'Networked digital mixer', '2010', null], ['مكسر Dante', 'Dante mixer', '2014', null],
    ['مكسر بتحكم لاسلكي', 'Wireless-control mixer', '2016', null], ['مكسر ألياف', 'Fibre-stage mixer', '2018', null], ['مكسر سحابي', 'Cloud mixer', '2021', null],
    ['مكسر بخلط تلقائي ذكي', 'AI auto-mix', '2023', null], ['مهندس صوت ذكي', 'AI sound engineer', '2025', null], ['مكسر عصبي مستقبلي', 'Neural future mixer', 'future', null]],
  switcher: [
    ['مبدّل بمرحّلات', 'Relay switcher', '1940s', null], ['مازج صورة', 'Vision mixer', '1960s', null], ['مبدّل بمؤثرات', 'Effects switcher', '1970s', null],
    ['مؤثرات رقمية DVE', 'DVE switcher', '1980s', null], ['مبدّل SD', 'SD switcher', '1990s', null], ['مبدّل SDI', 'SDI switcher', '1998', null],
    ['مبدّل HD', 'HD switcher', '2005', null], ['مبدّل HDMI و SDI', 'HDMI + SDI switcher', '2010', null], ['مبدّل بث مباشر', 'Live-stream switcher', '2015', null],
    ['مبدّل 4K', '4K switcher', '2017', null], ['مبدّل IP و NDI', 'IP / NDI switcher', '2019', null], ['مبدّل ألياف 8K', '8K fibre switcher', '2021', null],
    ['مخرج ذكي', 'AI director switcher', '2023', null], ['استوديو ذكي متكامل', 'AI studio brain', '2025', null], ['مبدّل كمّي مستقبلي', 'Quantum future switcher', 'future', null]],
  lightdesk: [
    ['لوحة خافت يدوية', 'Manual dimmer board', '1930s', null], ['لوحة خافت مقاومة', 'Resistance dimmer', '1950s', null], ['لوحة ثايرستور', 'Thyristor dimmer', '1960s', null],
    ['لوحة بذاكرة', 'Memory console', '1975', null], ['طاولة DMX', 'DMX console', '1986', null], ['طاولة كشافات متحركة', 'Moving-light desk', '1995', null],
    ['طاولة حاسوبية', 'PC lighting desk', '2005', null], ['طاولة بلمس', 'Touch console', '2010', null], ['طاولة لاسلكية', 'Wireless console', '2014', null],
    ['طاولة Art-Net', 'Art-Net console', '2016', null], ['طاولة بمحاكاة ثلاثية', '3D-visualiser desk', '2018', null], ['طاولة سحابية', 'Cloud console', '2021', null],
    ['مصمم إضاءة ذكي', 'AI lighting designer', '2023', null], ['تزامن موسيقي ذكي', 'AI music-sync desk', '2025', null], ['طاولة عصبية مستقبلية', 'Neural future desk', 'future', null]],
};

// hubs: which connectors each hub level supports (cumulative history)
const H = {
  mixer: [['trs'], ['trs'], ['trs', 'xlr'], ['trs', 'xlr'], ['trs', 'xlr'], ['trs', 'xlr'], ['trs', 'xlr', 'usbc'], ['trs', 'xlr', 'usbc', 'ethernet'], ['trs', 'xlr', 'usbc', 'ethernet'],
    ['trs', 'xlr', 'usbc', 'ethernet', 'wireless'], ['trs', 'xlr', 'usbc', 'ethernet', 'wireless', 'fiber'], ['trs', 'xlr', 'usbc', 'ethernet', 'wireless', 'fiber'], 'all', 'all', 'all'],
  switcher: [['rca'], ['rca'], ['rca'], ['rca'], ['rca'], ['rca', 'sdi'], ['rca', 'sdi'], ['sdi', 'hdmi'], ['sdi', 'hdmi', 'usbc'], ['sdi', 'hdmi', 'usbc', 'ethernet'],
    ['sdi', 'hdmi', 'usbc', 'ethernet'], ['sdi', 'hdmi', 'usbc', 'ethernet', 'fiber'], 'all', 'all', 'all'],
  lightdesk: [[], [], [], [], ['dmx'], ['dmx'], ['dmx', 'usbc'], ['dmx', 'usbc'], ['dmx', 'usbc', 'wireless'], ['dmx', 'usbc', 'wireless', 'ethernet'], ['dmx', 'usbc', 'wireless', 'ethernet'], ['dmx', 'usbc', 'wireless', 'ethernet'], 'all', 'all', 'all'],
};
export const HUB_OF = { audio: 'mixer', video: 'switcher', lights: 'lightdesk' };
export const supports = (hub, lv, conn) => { const s = H[hub][lv - 1]; return s === 'all' || s.includes(conn); };

// generic ladders: [arabic stage, english stage, era]
const G = {
  device: [['بدائي', 'Primitive', '1900s'], ['ميكانيكي', 'Mechanical', '1920s'], ['كهربائي', 'Electric', '1940s'], ['ترانزستور', 'Transistor', '1960s'], ['محمول', 'Portable', '1970s'],
    ['رقمي', 'Digital', '1980s'], ['حاسوبي', 'Computerised', '1990s'], ['لاسلكي', 'Wireless', '2000s'], ['عالي الدقة', 'High-definition', '2008'], ['ذكي', 'Smart', '2012'],
    ['شبكي', 'Networked', '2016'], ['سحابي', 'Cloud', '2019'], ['بذكاء صناعي', 'AI-powered', '2023'], ['ذكاء صناعي متقدم', 'Advanced AI', '2025'], ['مستقبلي', 'Future', 'future']],
  appliance: [['يدوي', 'Hand-operated', '1900s'], ['ميكانيكي', 'Mechanical', '1920s'], ['كهربائي', 'Electric', '1940s'], ['أوتوماتيكي', 'Automatic', '1960s'], ['تجاري', 'Commercial', '1970s'],
    ['رقمي', 'Digital', '1990s'], ['احترافي', 'Professional', '2000s'], ['موفّر للطاقة', 'Eco', '2008'], ['متصل', 'Connected', '2014'], ['ذكي', 'Smart', '2017'],
    ['بتحكم صوتي', 'Voice-controlled', '2019'], ['روبوتي', 'Robotic', '2021'], ['بذكاء صناعي', 'AI', '2023'], ['ذكاء صناعي متقدم', 'Advanced AI', '2025'], ['مستقبلي', 'Future', 'future']],
  stagefx: [['يدوي', 'Manual', '1950s'], ['كهربائي', 'Electric', '1965'], ['بمؤقت', 'Timed', '1975'], ['بجهاز تحكم', 'Remote', '1982'], ['DMX', 'DMX', '1986', 'dmx'],
    ['احترافي DMX', 'Pro DMX', '1995', 'dmx'], ['عالي الإنتاج', 'High-output', '2005', 'dmx'], ['لاسلكي', 'Wireless', '2012', 'wireless'], ['ملوّن LED', 'LED-tinted', '2015', 'wireless'],
    ['متزامن', 'Synced', '2017', 'wireless'], ['شبكي', 'Networked', '2019', 'ethernet'], ['تفاعلي', 'Interactive', '2021', 'ethernet'], ['بذكاء صناعي', 'AI-synced', '2023', 'wireless'],
    ['ذكاء صناعي متقدم', 'Advanced AI', '2025', 'wireless'], ['مستقبلي', 'Future', 'future', 'wireless']],
  decolight: [['زيتي', 'Oil', '1800s'], ['غازي', 'Gas', '1880s'], ['متوهج', 'Incandescent', '1900s'], ['نيون', 'Neon', '1920s'], ['فلورسنت', 'Fluorescent', '1950s'],
    ['هالوجين', 'Halogen', '1970s'], ['LED', 'LED', '1995', 'dmx'], ['RGB', 'RGB', '2005', 'dmx'], ['بكسلي', 'Pixel', '2010', 'dmx'], ['ذكي', 'Smart', '2015', 'wireless'],
    ['متزامن مع الموسيقى', 'Music-synced', '2018', 'wireless'], ['شبكي', 'Networked', '2020', 'ethernet'], ['بذكاء صناعي', 'AI', '2023', 'wireless'], ['ذكاء صناعي متقدم', 'Advanced AI', '2025', 'wireless'], ['هولوغرامي', 'Holographic', 'future', 'wireless']],
  craft: [['بسيط', 'Simple'], ['مصنوع يدويًا', 'Handmade'], ['متقن', 'Fine'], ['فاخر', 'Deluxe'], ['حرفي ماهر', 'Artisan'], ['مصمم', 'Designer'], ['إصدار محدود', 'Limited edition'],
    ['قطعة متحف', 'Museum piece'], ['تحفة', 'Masterpiece'], ['رقمي', 'Digital'], ['تفاعلي', 'Interactive'], ['ذكي', 'Smart'], ['بذكاء صناعي', 'AI'], ['هولوغرامي', 'Holographic'], ['أسطوري', 'Legendary']],
  outfit: [['قطن بسيط', 'Plain cotton'], ['مخيط يدويًا', 'Hand-sewn'], ['مفصّل', 'Tailored'], ['فاخر', 'Luxury fabric'], ['تصميم أزياء', 'Couture'], ['خامة تقنية', 'Tech fabric'],
    ['مضاد للتجاعيد', 'Wrinkle-free'], ['مقاوم للماء', 'Waterproof'], ['مضيء', 'Glow fabric'], ['ذكي', 'Smart fabric'], ['متغير اللون', 'Colour-shift'], ['بحساسات', 'Sensor-lined'],
    ['بذكاء صناعي', 'AI-adaptive'], ['هولوغرامي', 'Holographic'], ['أسطوري', 'Legendary']],
  vehicle: [['بدائي', 'Early'], ['كلاسيكي', 'Classic'], ['قديم مجدّد', 'Restored'], ['عائلي', 'Family'], ['رياضي', 'Sport'], ['فاخر', 'Luxury'], ['هجين', 'Hybrid'],
    ['كهربائي', 'Electric'], ['متصل', 'Connected'], ['شبه ذاتي', 'Semi-autonomous'], ['ذاتي القيادة', 'Self-driving'], ['طائر', 'Flying'], ['بذكاء صناعي', 'AI'], ['خارق', 'Hyper'], ['مستقبلي', 'Future']],
  pet: [['شارد', 'Stray'], ['مستأنس', 'Tamed'], ['أليف', 'Friendly'], ['مدرّب', 'Trained'], ['ذكي', 'Clever'], ['بطل', 'Champion'], ['نجم', 'Star'], ['وفي جدًا', 'Devoted'],
    ['أصيل', 'Pure-bred'], ['ملكي', 'Royal'], ['مشهور', 'Famous'], ['أسطورة المسابقات', 'Show legend'], ['رفيق ذكي', 'AI companion'], ['ملحمي', 'Epic'], ['أسطوري', 'Legendary']],
  show: [['بسيط', 'Simple'], ['ملوّن', 'Colourful'], ['مبهج', 'Joyful'], ['لامع', 'Sparkling'], ['ضخم', 'Grand'], ['استعراضي', 'Showpiece'], ['ألعاب ضوئية', 'Light-show'],
    ['ثلاثي الأبعاد', '3D'], ['واقع معزز', 'AR'], ['تفاعلي', 'Interactive'], ['متزامن', 'Synced'], ['سينمائي', 'Cinematic'], ['بذكاء صناعي', 'AI'], ['هولوغرامي', 'Holographic'], ['أسطوري', 'Legendary']],
  potency: [['خفيف', 'Mild'], ['عادي', 'Regular'], ['مركّز', 'Concentrated'], ['قوي', 'Strong'], ['مضاعف', 'Double'], ['ممتاز', 'Premium'], ['خاص', 'Special'],
    ['نادر', 'Rare'], ['نخبة', 'Elite'], ['ملكي', 'Royal'], ['ماسي', 'Diamond'], ['خارق', 'Super'], ['بذكاء صناعي', 'AI-tuned'], ['ملحمي', 'Epic'], ['أسطوري', 'Legendary']],
  backdrop: [['خلفية مرسومة', 'Painted backdrop', '1930s'], ['شاشة زرقاء', 'Blue screen', '1940s', 'rca'], ['كروما', 'Chroma key', '1970s', 'rca'], ['شاشة خضراء', 'Green screen', '1990s', 'sdi'],
    ['خلفية افتراضية', 'Virtual set', '1998', 'sdi'], ['إسقاط خلفي', 'Rear projection', '2005', 'sdi'], ['جدار شاشات', 'Video wall', '2010', 'hdmi'], ['جدار LED', 'LED wall', '2015', 'sdi'],
    ['استوديو XR', 'XR stage', '2019', 'ethernet'], ['حجم LED', 'LED volume', '2020', 'fiber'], ['تتبع كاميرا', 'Camera-tracked', '2021', 'ethernet'], ['واقع مختلط', 'Mixed reality', '2022', 'ethernet'],
    ['خلفية مولّدة بالذكاء', 'AI-generated set', '2023', 'wireless'], ['عالم ذكي حي', 'Live AI world', '2025', 'wireless'], ['هولوديك مستقبلي', 'Future holodeck', 'future', 'wireless']],
  estate: [['أرض فضاء', 'Empty plot'], ['مخطط', 'Planned'], ['مسوّر', 'Walled'], ['عظم', 'Shell'], ['مشطّب', 'Finished'], ['مؤثث', 'Furnished'], ['فاخر', 'Luxury'],
    ['ذكي', 'Smart'], ['مستدام', 'Sustainable'], ['معلم', 'Landmark'], ['مجمّع', 'Compound'], ['مدينة مصغّرة', 'Mini city'], ['بذكاء صناعي', 'AI-managed'], ['مشروع عملاق', 'Giga project'], ['أسطوري', 'Legendary']],
  cable: [['سلك عادي', 'Basic wire'], ['معزول', 'Insulated'], ['مدرّع', 'Shielded'], ['مزدوج التدريع', 'Double-shielded'], ['أطراف مذهبة', 'Gold-tipped'], ['مجدول', 'Braided'],
    ['خالي الأكسجين', 'Oxygen-free'], ['استوديو', 'Studio-grade'], ['بث', 'Broadcast-grade'], ['عسكري', 'Mil-spec'], ['طويل المدى', 'Long-run'], ['بدون فقد', 'Lossless'],
    ['بمراقبة ذكية', 'AI-monitored'], ['ذاتي الإصلاح', 'Self-healing'], ['أسطوري', 'Legendary']],
};

// family -> [track, signal group (needs a hub) or null]
export const FAM_TRACK = {
  'equip.cam': ['camera', 'video'], 'equip.mic': ['mic', 'audio'], 'equip.light': ['light', 'lights'], 'equip.mixer': ['mixer', null], 'equip.switcher': ['switcher', null],
  'equip.lightdesk': ['lightdesk', null], 'equip.prompter': ['device', 'video'], 'equip.monitor': ['device', 'video'], 'equip.drone': ['device', 'video'], 'equip.gimbal': ['device', null],
  'equip.headset': ['device', 'audio'], 'equip.pc': ['device', 'video'], 'equip.ring': ['decolight', 'lights'], 'equip.green': ['backdrop', 'video'], 'equip.radio': ['device', 'audio'],
  'machines.smoke': ['stagefx', 'lights'], 'machines.bubbles': ['stagefx', 'lights'], 'machines.karaoke': ['device', 'audio'], 'machines.printer': ['device', null], 'machines.robot': ['device', null],
  'machines.arcade': ['device', null], 'machines.generator': ['appliance', null],
  'decor.neon': ['decolight', 'lights'], 'decor.led': ['decolight', 'lights'], 'decor.lantern': ['decolight', 'lights'], 'decor.disco': ['stagefx', 'lights'],
  'fx.entrance': ['stagefx', 'lights'], 'fx.sparkle': ['stagefx', 'lights'], 'fx.bolt': ['stagefx', 'lights'],
};
const CAT_TRACK = { gifts: 'show', skins: 'outfit', machines: 'appliance', furniture: 'craft', decor: 'craft', vehicles: 'vehicle', pets: 'pet', accs: 'craft', fx: 'show', boosts: 'potency', sets: 'backdrop', estate: 'estate', cables: 'cable', equip: 'device' };

export function trackOf(cat, fam) { const ft = FAM_TRACK[cat + '.' + fam]; return ft ? ft[0] : CAT_TRACK[cat]; }
export function signalOf(cat, fam) { const ft = FAM_TRACK[cat + '.' + fam]; if (ft) return ft[1]; if (cat === 'sets') return 'video'; return null; }
// level info for a family: { ar, en, era, conn, full } where full=true when the name already includes the device type
export function levelInfo(cat, fam, lv) {
  const tr = trackOf(cat, fam);
  if (T[tr]) { const [ar, en, era, conn] = T[tr][lv - 1]; return { ar, en, era, conn: signalOf(cat, fam) ? conn : null, full: true }; }
  const [ar, en, era, conn] = G[tr][lv - 1];
  const sig = signalOf(cat, fam);
  let c = conn || null;
  if (sig && !c && tr === 'device') c = lv <= 5 ? { video: 'rca', audio: 'trs', lights: null }[sig] : lv <= 8 ? { video: 'hdmi', audio: 'xlr', lights: 'dmx' }[sig] : lv <= 10 ? 'usbc' : lv <= 12 ? 'ethernet' : 'wireless';
  if (cat === 'cables') c = fam;
  return { ar, en, era: era || '', conn: sig || cat === 'cables' ? c : null, full: false };
}
// flaws at low levels and strengths at high levels, by signal group / category
export function qualityNote(cat, fam, lv) {
  const sig = signalOf(cat, fam), tr = trackOf(cat, fam);
  if (lv <= 3) return { kind: 'flaw', key: sig === 'video' ? 'fl_video' : sig === 'audio' ? 'fl_audio' : sig === 'lights' ? 'fl_light' : tr === 'cable' ? 'fl_cable' : 'fl_basic' };
  if (lv >= 13) return { kind: 'ai', key: 'ft_ai' };
  return null;
}
