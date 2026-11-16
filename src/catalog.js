// App-token store catalog: 14 categories, ~150 families, 5 rarities each (~750 cards).
// Every card has a use (effect) and a goal (category purpose). Three identical cards merge into the next rarity.
// Prices are final (16 Nov 2026): 2 / 5 / 8 / 14 / 24 tokens, 1 token = 0.000001 Pi.

export const RARITY = [
  { id: 'r1', price: 2, mult: 1, color: '#9aa3b5' },
  { id: 'r2', price: 5, mult: 2, color: '#3fbf6f' },
  { id: 'r3', price: 8, mult: 3.5, color: '#3a8bff' },
  { id: 'r4', price: 14, mult: 5.5, color: '#a463ff' },
  { id: 'r5', price: 24, mult: 8, color: '#ffb020' },
];

// effect types: what a card does in the game. base value at rarity 1; multiplied by RARITY.mult.
export const EFFECTS = {
  coins: { base: 2, unit: '%', cap: 60 },   // more coins per round
  xp: { base: 2, unit: '%', cap: 60 },      // more XP per round
  trust: { base: 1, unit: '', cap: 15 },    // starting trust bonus (points)
  fix: { base: 0.5, unit: '', cap: 6 },     // extra trust per prank you fix
  luck: { base: 1, unit: '%', cap: 30 },    // chance of a bonus card after a round
  fans: { base: 25, unit: '', cap: 99999 }, // followers (popularity score)
  style: { base: 5, unit: '', cap: 99999 }, // stage rating
};

// kind: equip (uses a slot), use (consumable: lasts one round), future (activates with buildings)
export const CATS = [
  { id: 'equip', icon: '🎥', kind: 'equip', slots: 3 },
  { id: 'gifts', icon: '🎁', kind: 'use' },
  { id: 'skins', icon: '👔', kind: 'equip', slots: 1 },
  { id: 'machines', icon: '⚙️', kind: 'equip', slots: 2 },
  { id: 'furniture', icon: '🛋️', kind: 'equip', slots: 3 },
  { id: 'decor', icon: '🪴', kind: 'equip', slots: 3 },
  { id: 'vehicles', icon: '🏎️', kind: 'equip', slots: 1 },
  { id: 'pets', icon: '🐈', kind: 'equip', slots: 1 },
  { id: 'accs', icon: '🕶️', kind: 'equip', slots: 2 },
  { id: 'fx', icon: '✨', kind: 'equip', slots: 2 },
  { id: 'boosts', icon: '⚡', kind: 'use' },
  { id: 'sets', icon: '🌆', kind: 'equip', slots: 1 },
  { id: 'estate', icon: '🏡', kind: 'future' },
];

// [category, id, emoji, effect, Arabic name, English name]
const F = [
  // broadcast equipment
  ['equip', 'cam', '🎥', 'fans', 'كاميرا احترافية', 'Pro camera'], ['equip', 'mic', '🎙️', 'trust', 'مايكروفون استوديو', 'Studio microphone'],
  ['equip', 'light', '💡', 'style', 'إضاءة سوفت بوكس', 'Softbox light'], ['equip', 'mixer', '🎛️', 'coins', 'مكسر صوت', 'Audio mixer'],
  ['equip', 'prompter', '📜', 'trust', 'تيليبرومبتر', 'Teleprompter'], ['equip', 'monitor', '🖥️', 'fix', 'شاشة مراقبة', 'Control monitor'],
  ['equip', 'drone', '🛸', 'fans', 'درون تصوير', 'Camera drone'], ['equip', 'gimbal', '📹', 'style', 'مثبّت كاميرا', 'Camera gimbal'],
  ['equip', 'headset', '🎧', 'fix', 'سماعة المخرج', "Director's headset"], ['equip', 'pc', '💻', 'xp', 'جهاز بث احترافي', 'Streaming PC'],
  ['equip', 'ring', '⭕', 'style', 'إضاءة دائرية', 'Ring light'], ['equip', 'green', '🟩', 'xp', 'شاشة خضراء', 'Green screen'],
  ['equip', 'switcher', '🔀', 'coins', 'مبدّل الكاميرات', 'Video switcher'], ['equip', 'radio', '📻', 'fix', 'لاسلكي الطاقم', 'Crew radio'],
  // live-stream gifts (one round)
  ['gifts', 'rose', '🌹', 'trust', 'وردة', 'Rose'], ['gifts', 'cake', '🎂', 'fans', 'كيكة احتفال', 'Party cake'],
  ['gifts', 'fireworks', '🎆', 'fans', 'ألعاب نارية', 'Fireworks'], ['gifts', 'confetti', '🎊', 'style', 'مدفع قصاصات', 'Confetti cannon'],
  ['gifts', 'trophy', '🏆', 'xp', 'كأس ذهبي', 'Golden trophy'], ['gifts', 'crown', '👑', 'trust', 'تاج النجوم', 'Star crown'],
  ['gifts', 'heart', '💖', 'trust', 'قلب عملاق', 'Giant heart'], ['gifts', 'star', '🌟', 'coins', 'نجمة لامعة', 'Shining star'],
  ['gifts', 'balloons', '🎈', 'fans', 'باقة بالونات', 'Balloon bunch'], ['gifts', 'surprise', '🎁', 'luck', 'صندوق مفاجآت', 'Surprise box'],
  ['gifts', 'falcon', '🦅', 'coins', 'صقر ذهبي', 'Golden falcon'], ['gifts', 'oud', '🪔', 'trust', 'عود وبخور', 'Oud & incense'],
  // outfits
  ['skins', 'thobe', '🧣', 'trust', 'ثوب وشماغ', 'Thobe & shemagh'], ['skins', 'bisht', '🥇', 'fans', 'بشت ملكي', 'Royal bisht'],
  ['skins', 'tux', '🤵', 'style', 'بدلة سهرة', 'Tuxedo'], ['skins', 'astro', '👨‍🚀', 'xp', 'رائد فضاء', 'Astronaut'],
  ['skins', 'chef', '👨‍🍳', 'coins', 'طاهٍ محترف', 'Master chef'], ['skins', 'pilot', '🧑‍✈️', 'fix', 'طيار', 'Pilot'],
  ['skins', 'sport', '⚽', 'xp', 'لاعب كرة', 'Football star'], ['skins', 'ninja', '🥷', 'fix', 'نينجا', 'Ninja'],
  ['skins', 'detective', '🕵️', 'fix', 'محقق', 'Detective'], ['skins', 'wizard', '🧙', 'luck', 'ساحر', 'Wizard'],
  ['skins', 'cowboy', '🤠', 'fans', 'راعي بقر', 'Cowboy'], ['skins', 'diver', '🤿', 'luck', 'غوّاص', 'Diver'],
  ['skins', 'inventor', '🥼', 'xp', 'مخترع', 'Inventor'], ['skins', 'knight', '🛡️', 'trust', 'فارس', 'Knight'],
  // machines
  ['machines', 'coffee', '☕', 'xp', 'آلة قهوة', 'Coffee machine'], ['machines', 'popcorn', '🍿', 'fans', 'آلة فشار', 'Popcorn machine'],
  ['machines', 'smoke', '💨', 'style', 'آلة دخان', 'Smoke machine'], ['machines', 'bubbles', '🫧', 'style', 'آلة فقاعات', 'Bubble machine'],
  ['machines', 'arcade', '🕹️', 'luck', 'آلة أركيد', 'Arcade cabinet'], ['machines', 'vending', '🥤', 'coins', 'آلة بيع', 'Vending machine'],
  ['machines', 'printer', '🖨️', 'xp', 'طابعة ثلاثية الأبعاد', '3D printer'], ['machines', 'robot', '🤖', 'fix', 'روبوت مساعد', 'Robot assistant'],
  ['machines', 'generator', '🔋', 'coins', 'مولّد كهرباء', 'Power generator'], ['machines', 'icecream', '🍦', 'fans', 'آلة آيس كريم', 'Ice-cream machine'],
  ['machines', 'karaoke', '🎶', 'fans', 'جهاز كاريوكي', 'Karaoke machine'], ['machines', 'juice', '🧃', 'trust', 'آلة عصير', 'Juice machine'],
  // furniture
  ['furniture', 'sofa', '🛋️', 'trust', 'كنب جلد', 'Leather sofa'], ['furniture', 'anchor', '💺', 'trust', 'كرسي المذيع', "Anchor's chair"],
  ['furniture', 'desk', '🗄️', 'xp', 'مكتب الأخبار', 'News desk'], ['furniture', 'meeting', '🪑', 'xp', 'طاولة اجتماعات', 'Meeting table'],
  ['furniture', 'shelf', '📚', 'xp', 'مكتبة', 'Bookshelf'], ['furniture', 'rug', '🧶', 'style', 'سجادة فاخرة', 'Luxury rug'],
  ['furniture', 'majlis', '🕌', 'trust', 'جلسة مجلس', 'Majlis seating'], ['furniture', 'bed', '🛏️', 'luck', 'سرير مريح', 'Comfy bed'],
  ['furniture', 'wardrobe', '🚪', 'style', 'خزانة ملابس', 'Wardrobe'], ['furniture', 'coffeetable', '🫖', 'trust', 'طاولة ضيافة', 'Coffee table'],
  ['furniture', 'gaming', '🎮', 'coins', 'كرسي ألعاب', 'Gaming chair'], ['furniture', 'beanbag', '🫘', 'luck', 'بين باغ', 'Beanbag'],
  // decor
  ['decor', 'neon', '🔆', 'style', 'لوحة نيون', 'Neon sign'], ['decor', 'plants', '🪴', 'trust', 'نباتات زينة', 'House plants'],
  ['decor', 'lantern', '🏮', 'fans', 'فانوس رمضاني', 'Ramadan lantern'], ['decor', 'painting', '🖼️', 'style', 'لوحة فنية', 'Art painting'],
  ['decor', 'clock', '🕰️', 'fix', 'ساعة جدارية', 'Wall clock'], ['decor', 'palm', '🌴', 'trust', 'نخلة', 'Palm tree'],
  ['decor', 'fountain', '⛲', 'luck', 'نافورة', 'Fountain'], ['decor', 'led', '🌈', 'style', 'أضواء LED', 'LED strips'],
  ['decor', 'statue', '🗿', 'fans', 'تمثال', 'Statue'], ['decor', 'awards', '🏅', 'xp', 'رف الجوائز', 'Awards shelf'],
  ['decor', 'curtain', '🎭', 'style', 'ستارة مسرح', 'Stage curtain'], ['decor', 'disco', '🪩', 'fans', 'كرة ديسكو', 'Disco ball'],
  // vehicles
  ['vehicles', 'scooter', '🛴', 'fix', 'سكوتر', 'Scooter'], ['vehicles', 'bike', '🚲', 'xp', 'دراجة', 'Bicycle'],
  ['vehicles', 'motor', '🏍️', 'fans', 'دبّاب', 'Motorbike'], ['vehicles', 'golf', '🛺', 'luck', 'عربة جولف', 'Golf cart'],
  ['vehicles', 'foodtruck', '🚚', 'coins', 'فود ترك', 'Food truck'], ['vehicles', 'obvan', '🚐', 'xp', 'عربة بث خارجي', 'Broadcast van'],
  ['vehicles', 'sports', '🏎️', 'fans', 'سيارة رياضية', 'Sports car'], ['vehicles', 'limo', '🚘', 'trust', 'ليموزين', 'Limousine'],
  ['vehicles', 'heli', '🚁', 'fans', 'هليكوبتر', 'Helicopter'], ['vehicles', 'yacht', '🛥️', 'luck', 'يخت', 'Yacht'],
  ['vehicles', 'jetski', '🌊', 'style', 'جت سكي', 'Jet ski'], ['vehicles', 'balloon', '🪂', 'luck', 'منطاد', 'Hot-air balloon'],
  // pets
  ['pets', 'cat', '🐈', 'luck', 'قطة', 'Cat'], ['pets', 'falconpet', '🦅', 'fans', 'صقر', 'Falcon'],
  ['pets', 'parrot', '🦜', 'fans', 'ببغاء', 'Parrot'], ['pets', 'dog', '🐕', 'trust', 'كلب وفي', 'Loyal dog'],
  ['pets', 'horse', '🐎', 'style', 'حصان عربي', 'Arabian horse'], ['pets', 'turtle', '🐢', 'fix', 'سلحفاة', 'Turtle'],
  ['pets', 'rabbit', '🐇', 'luck', 'أرنب', 'Rabbit'], ['pets', 'owl', '🦉', 'xp', 'بومة', 'Owl'],
  ['pets', 'gazelle', '🦌', 'style', 'غزال', 'Gazelle'], ['pets', 'monkey', '🐒', 'coins', 'قرد مرح', 'Playful monkey'],
  // accessories
  ['accs', 'shades', '🕶️', 'style', 'نظارة شمسية', 'Sunglasses'], ['accs', 'watch', '⌚', 'fix', 'ساعة فاخرة', 'Luxury watch'],
  ['accs', 'ring', '💍', 'luck', 'خاتم', 'Ring'], ['accs', 'misbaha', '📿', 'trust', 'مسباح', 'Prayer beads'],
  ['accs', 'perfume', '🧴', 'fans', 'عطر', 'Perfume'], ['accs', 'pen', '🖋️', 'xp', 'قلم ذهبي', 'Golden pen'],
  ['accs', 'bag', '👜', 'coins', 'حقيبة', 'Bag'], ['accs', 'hat', '🎩', 'style', 'قبعة', 'Top hat'],
  ['accs', 'earbuds', '🎧', 'fix', 'سماعات لاسلكية', 'Wireless earbuds'], ['accs', 'bracelet', '📿', 'luck', 'سوار', 'Bracelet'],
  // effects and emotes
  ['fx', 'entrance', '✨', 'fans', 'دخول بالأضواء', 'Light entrance'], ['fx', 'aura', '🔵', 'trust', 'هالة', 'Aura'],
  ['fx', 'trail', '💫', 'style', 'أثر نجوم', 'Star trail'], ['fx', 'dance', '🕺', 'fans', 'رقصة', 'Dance'],
  ['fx', 'wave', '👋', 'trust', 'تحية الجمهور', 'Crowd wave'], ['fx', 'sparkle', '🎇', 'style', 'شرارات', 'Sparklers'],
  ['fx', 'rain', '🎉', 'luck', 'مطر قصاصات', 'Confetti rain'], ['fx', 'bolt', '⚡', 'xp', 'برق', 'Lightning'],
  ['fx', 'flame', '🔥', 'coins', 'شعلة', 'Flame'], ['fx', 'hearts', '💕', 'fans', 'قلوب طائرة', 'Floating hearts'],
  // boosts (one round)
  ['boosts', 'gahwa', '☕', 'trust', 'فنجان قهوة عربية', 'Arabic coffee'], ['boosts', 'dates', '🌰', 'xp', 'تمر', 'Dates'],
  ['boosts', 'energy', '🔋', 'xp', 'مشروب طاقة', 'Energy drink'], ['boosts', 'clover', '🍀', 'luck', 'تميمة حظ', 'Lucky charm'],
  ['boosts', 'hourglass', '⏳', 'fix', 'ساعة رملية', 'Hourglass'], ['boosts', 'book', '📘', 'xp', 'كتاب خبرة', 'Book of skills'],
  ['boosts', 'shield', '🛡️', 'fix', 'درع المقالب', 'Prank shield'], ['boosts', 'magnet', '🧲', 'coins', 'مغناطيس عملات', 'Coin magnet'],
  ['boosts', 'focus', '🎯', 'trust', 'تركيز', 'Focus'], ['boosts', 'ticket', '🎟️', 'fans', 'تذكرة VIP', 'VIP ticket'],
  // studio sets / backdrops
  ['sets', 'desert', '🏜️', 'trust', 'صحراء ليلية', 'Desert night'], ['sets', 'skyline', '🌆', 'fans', 'أفق المدينة', 'City skyline'],
  ['sets', 'space', '🌌', 'xp', 'الفضاء', 'Outer space'], ['sets', 'beach', '🏖️', 'luck', 'شاطئ', 'Beach'],
  ['sets', 'forest', '🌳', 'trust', 'غابة', 'Forest'], ['sets', 'mountain', '🏔️', 'style', 'جبال', 'Mountains'],
  ['sets', 'ocean', '🐠', 'luck', 'تحت الماء', 'Under the sea'], ['sets', 'stadium', '🏟️', 'fans', 'ملعب', 'Stadium'],
  ['sets', 'souq', '🏪', 'coins', 'سوق شعبي', 'Old souq'], ['sets', 'gala', '🎬', 'style', 'حفل جوائز', 'Awards gala'],
  // real estate (activates with the building system)
  ['estate', 'land', '🟫', 'coins', 'أرض', 'Land plot'], ['estate', 'flat', '🏢', 'coins', 'شقة', 'Apartment'],
  ['estate', 'villa', '🏡', 'luck', 'فيلا', 'Villa'], ['estate', 'istiraha', '🏕️', 'trust', 'استراحة', 'Rest house'],
  ['estate', 'studio', '🎬', 'xp', 'استوديو خاص', 'Private studio'], ['estate', 'tower', '🏙️', 'fans', 'برج', 'Tower'],
  ['estate', 'farm', '🌾', 'coins', 'مزرعة', 'Farm'], ['estate', 'palace', '🏰', 'style', 'قصر', 'Palace'],
  ['estate', 'island', '🏝️', 'luck', 'جزيرة', 'Island'], ['estate', 'mall', '🛍️', 'coins', 'مول', 'Mall'],
];

export const FAMILIES = F.map(([cat, id, icon, effect, ar, en]) => ({ cat, id, icon, effect, name: { ar, en } }));
const FAM = Object.fromEntries(FAMILIES.map((f) => [f.id + '@' + f.cat, f]));

// card id: "<cat>.<family>.<rarity 1-5>"
export const CARDS = [];
FAMILIES.forEach((f) => RARITY.forEach((r, i) => CARDS.push({ id: `${f.cat}.${f.id}.${i + 1}`, fam: f, r: i + 1 })));
export const card = (id) => { const [c, fid, r] = id.split('.'); const f = FAM[fid + '@' + c]; return f ? { id, fam: f, r: +r } : null; };
export const value = (c) => { const e = EFFECTS[c.fam.effect]; const v = e.base * RARITY[c.r - 1].mult; return e.unit === '%' || e.base < 1 ? Math.round(v * 10) / 10 : Math.round(v); };
export const priceOf = (c) => RARITY[c.r - 1].price;
export const catOf = (id) => CATS.find((c) => c.id === id);

// Collections: equipping every family of a set gives an extra bonus.
export const COLLECTIONS = [
  { id: 'kit', fams: ['equip.cam', 'equip.mic', 'equip.light'], bonus: { coins: 10, trust: 3 } },
  { id: 'host', fams: ['skins.tux', 'furniture.anchor', 'accs.watch'], bonus: { trust: 4, fans: 300 } },
  { id: 'majlis', fams: ['skins.thobe', 'furniture.majlis', 'decor.lantern'], bonus: { trust: 5, xp: 10 } },
  { id: 'party', fams: ['machines.smoke', 'decor.disco', 'fx.dance'], bonus: { fans: 500, style: 60 } },
  { id: 'tech', fams: ['equip.pc', 'machines.robot', 'equip.monitor'], bonus: { xp: 12, fix: 2 } },
  { id: 'desert', fams: ['sets.desert', 'pets.falconpet', 'decor.palm'], bonus: { luck: 6, trust: 3 } },
];
