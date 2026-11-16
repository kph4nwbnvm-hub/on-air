import TR from './tr.js';
import TR_SHOP from './tr_shop.js';
import TR_DAILY from './tr_daily.js';
import TR_PROFILE from './tr_profile.js';
import ST1, { KEYS as ST_KEYS } from './tr_store1.js';
import ST2 from './tr_store2.js';
import ST3, { KEYS3 } from './tr_store3.js';
import TT, { KEYS_T } from './tr_tour.js';
import TA, { KEYS_AD } from './tr_ads.js';
import TS, { KEYS_S } from './tr_story.js';
import TI, { KEYS_IV } from './tr_street.js';
import TP, { KEYS_PC } from './tr_pc.js';
import TC, { KEYS_CH } from './tr_ch.js';
import TO, { KEYS_OBJ } from './tr_obj.js';
import TPB, { KEYS_PUB } from './tr_pub.js';
import TD2, { KEYS_DR } from './tr_dress.js';
// The 53 languages of the Pi system, in the order the project owner supplied them.
export const LANGS = [
  { code: 'ar', name: 'العربية', rtl: true }, { code: 'en', name: 'English' }, { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Shqip' }, { code: 'bn', name: 'বাংলা' }, { code: 'bg', name: 'Български' },
  { code: 'ca', name: 'Català' }, { code: 'hr', name: 'Hrvatski' }, { code: 'cs', name: 'Čeština' },
  { code: 'da', name: 'Dansk' }, { code: 'nl', name: 'Nederlands' }, { code: 'et', name: 'Eesti' },
  { code: 'fa', name: 'فارسی', rtl: true }, { code: 'fil', name: 'Filipino' }, { code: 'fi', name: 'Suomi' },
  { code: 'fr', name: 'Français' }, { code: 'ka', name: 'ქართული' }, { code: 'de', name: 'Deutsch' },
  { code: 'el', name: 'Ελληνικά' }, { code: 'ht', name: 'Kreyòl Ayisyen' }, { code: 'he', name: 'עברית', rtl: true },
  { code: 'hi', name: 'हिन्दी' }, { code: 'te', name: 'తెలుగు' }, { code: 'hu', name: 'Magyar' },
  { code: 'id', name: 'Bahasa Indonesia' }, { code: 'it', name: 'Italiano' }, { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' }, { code: 'ku', name: 'Kurdî' }, { code: 'lv', name: 'Latviešu' },
  { code: 'lt', name: 'Lietuvių' }, { code: 'mk', name: 'Македонски' }, { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'ml', name: 'മലയാളം' }, { code: 'ne', name: 'नेपाली' }, { code: 'no', name: 'Norsk' },
  { code: 'pl', name: 'Polski' }, { code: 'pt', name: 'Português' }, { code: 'ro', name: 'Română' },
  { code: 'ru', name: 'Русский' }, { code: 'sr', name: 'Српски' }, { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁體中文' }, { code: 'sk', name: 'Slovenčina' }, { code: 'sl', name: 'Slovenščina' },
  { code: 'es', name: 'Español' }, { code: 'sw', name: 'Kiswahili' }, { code: 'sv', name: 'Svenska' },
  { code: 'th', name: 'ไทย' }, { code: 'tr', name: 'Türkçe' }, { code: 'uk', name: 'Українська' },
  { code: 'ur', name: 'اردو', rtl: true }, { code: 'vi', name: 'Tiếng Việt' },
];

export const STR = {
  ar: {
    title: 'على الهوا', tagline: 'لعبة البث والمقالب', play: 'العب', how: 'كيف تلعب؟', back: 'رجوع',
    proto: 'نموذج أولي: استوديو، شارع، وحفل جوائز',
    how1: 'الجولة ثلاث دقائق: دقيقة ونص لفقرة الراعي، ودقيقة ونص لمقابلة الكابتن برق.',
    how2: 'العصا أو الأسهم: قدّام وورا تمشي، يمين ويسار تلف. لما تقرب من شي يطلع لك زر الإجراء (أو اضغط المسافة).',
    how3: 'شاشة «البث» تورّيك وش يشوف الجمهور. في فقرة الراعي لازم كاميرا ١ والعلبة الذهبية ظاهرة. في المقابلة لازم كاميرا ٢.',
    how4: 'أحد راح يخرّب عليك: يبدّل المنتج، يحوّل الكاميرا، يطفي الإضاءة، أو يرمي كونفيتي. صلّح وارجع كمّل.',
    how5: 'في المقابلة اسأل الضيف ثلاثة أسئلة. السؤال الموفّق يرفع ثقة الراعي والمحرج ينزّلها. تحتاج ٧٠٪ عشان تنجح.',
    trust: 'ثقة الراعي', live: 'على الهوا', feed: 'البث', cam: 'كاميرا', need: 'المطلوب: كاميرا',
    seg1: 'فقرة الراعي', seg2: 'المقابلة',
    a_product: 'بدّل المنتج', a_console: 'حوّل الكاميرا', a_light: 'الإضاءة', a_clean: 'نظّف', a_ask: 'اسأل الضيف',
    sp_start: 'الراعي: أبغى العلبة الذهبية واضحة على كاميرا ١.',
    sp_product: 'الراعي: هذا منظّف! وين منتجي؟', sp_camera: 'الراعي: الجمهور يشوف الكاميرا الغلط!',
    sp_light: 'الراعي: ما أشوف شي! شغّلوا الإضاءة.', sp_confetti: 'الراعي: الاستوديو صار حفلة. نظّفوه!',
    sp_ok: 'الراعي: كذا تمام.', sp_seg2: 'المخرج: بدأت المقابلة. حوّل على كاميرا ٢ وروح للضيف.',
    sp_end_great: 'الراعي: شغل نظيف. العقد الجاي لك.', sp_end_ok: 'الراعي: مشّيناها، بس انتبه المرة الجاية.',
    sp_end_bad: 'الراعي: إعلاني تحوّل مقلب. نتكلم بعدين.',
    guest: 'الكابتن برق', iv_pick: 'اختر سؤالك', iv_good: 'سؤال موفّق', iv_meh: 'سؤال عادي', iv_bad: 'سؤال محرج',
    q00: 'وش اللحظة اللي غيّرت موسمك؟', a00: 'هدف الدقيقة تسعين. من يومها ما أنام إلا والكورة جنبي.',
    q01: 'كيف الجو اليوم؟', a01: 'حلو... بس أنا جاي أتكلم عن الكورة.',
    q02: 'ليش ضيّعت ضربة الجزاء؟', a02: 'جايبني تحرجني على الهوا؟',
    q10: 'مين أول مدرب آمن فيك؟', a10: 'مدرب الحارة. كان يدفع لي حق الباص.',
    q11: 'وش أكلت على الفطور؟', a11: 'بيض. السؤال اللي بعده.',
    q12: 'صحيح إنك تبغى تترك النادي؟', a12: 'هذا كلام مجالس. غيّر الموضوع.',
    q20: 'وش تقول للصغار اللي يحلمون يصيرون مثلك؟', a20: 'العبوا كل يوم، حتى لو الملعب رصيف.',
    q21: 'كم مقاس جزمتك؟', a21: '٤٣. معلومة مهمة للجمهور أكيد.',
    q22: 'كم راتبك؟', a22: 'اسأل وكيل أعمالي. المقابلة خلصت؟',
    r_pass: 'نجحت في العقد', r_fail: 'العقد ما نجح', r_trust: 'ثقة الراعي', r_air: 'وقت البث السليم',
    r_coins: 'عملة الاستوديو', r_what: 'وش صار في البث', r_none: 'ولا مقلب. بث هادئ.',
    r_fixed: 'انصلح بعد', r_unfixed: 'ما انصلح', r_self: 'من يدك', sec: 'ث',
    r_iv: 'المقابلة', r_noq: 'سؤال ما انسأل',
    p_product: 'تبديل المنتج', p_camera: 'الكاميرا الغلط', p_light: 'العبث بالإضاءة', p_confetti: 'الكونفيتي',
    customize: 'تعديل الشخصية', done: 'تم', sound: 'الصوت', coins: 'عملات', to_menu: 'القائمة', roam: 'ارجع للاستوديو',
    roam_hint: 'تجوّل وكلّم الناس. ابدأ البث من طاولة التحكم، أو اطلع من الباب.',
    z_studio: 'الاستوديو', z_street: 'الشارع', z_event: 'حفل الجوائز',
    a_start: 'ابدأ البث', a_exit: 'اطلع برا', a_enter: 'ادخل الاستوديو', a_event: 'روح للحفل', a_back: 'ارجع للشارع', a_talk: 'كلّم', a_interview: 'قابل',
    t_skin: 'سكين', t_hair: 'الشعر', t_clothes: 'الملابس', t_acc: 'الإكسسوارات',
    c_style: 'القصة', c_color: 'اللون', c_beard: 'الدقن', c_top: 'العلوي', c_bottom: 'السفلي', c_shoes: 'الحذاء', c_cap: 'لون الكاب',
    o_none: 'بدون', o_full: 'لحية كاملة', o_goatee: 'سكسوكة', o_mustache: 'شنب', o_tshirt: 'تيشيرت', o_hoodie: 'هودي', o_jacket: 'جاكيت', o_pants: 'بنطلون', o_shorts: 'شورت',
    o_cap: 'كاب', o_glasses: 'نظارة', o_headphones: 'سماعات', o_earring: 'حلق', o_chain: 'سلسال', o_bracelet: 'إسوارة', o_watch: 'ساعة', o_bag: 'شنطة',
    n_fan: 'معجب', n_fan1: 'أنت اللي تبث من الاستوديو؟ صوّر معي!', n_fan2: 'تابعتك أمس. فقرة المنظّف كانت أحلى شي.',
    n_vendor: 'بيّاع الشاورما', n_vendor1: 'شاورما للمذيع؟ لك خصم إذا ذكرتني في البث.', n_vendor2: 'الراعي حقك يشتري من عندي كل يوم. لا تقول له إني قلت.',
    n_kid: 'ولد الحارة', n_kid1: 'تعرف الكابتن برق؟ سلّم لي عليه!', n_kid2: 'إذا كبرت بصير مذيع مثلك. أو لاعب. أو الاثنين.',
    n_rival: 'ستريمر منافس', n_rival1: 'استوديوك صغير. أنا عندي ثلاث كاميرات... آه، وأنت بعد.', n_rival2: 'نتقابل في الحفل. إذا دخّلوك.',
    n_guard: 'الأمن', n_guard1: 'منطقة الإعلاميين للاستوديوهات الموثّقة بس. وثّق استوديوك وتعال.', n_guard2: 'السجادة الحمراء مفتوحة للكل. تفضّل.',
    n_fans: 'الجمهور', n_fans1: 'برق! برق! برق!',
    star_s: 'النجمة سما', star_t: 'الممثل زين', iv_done: 'خلصت المقابلة',
    qs0: 'وش الأغنية اللي غيّرت حياتك؟', as0: 'أغنية كتبتها في المطبخ. صارت الأولى في أسبوع.',
    qs1: 'وش لونك المفضّل؟', as1: 'البنفسجي. شكرًا على السؤال العميق.',
    qs2: 'صحيح إنك تغنّين بلاي باك؟', as2: 'الأمن! وين الأمن؟',
    qt0: 'وش أصعب مشهد صوّرته؟', at0: 'مشهد بكيت فيه تحت مطر صناعي عشر ساعات.',
    qt1: 'كم فيلم سوّيت؟', at1: 'عدّهم في الإنترنت يا بطل.',
    qt2: 'ليش فيلمك الأخير فشل؟', at2: 'المقابلة انتهت.',
    again: 'جولة ثانية', menu: 'القائمة', language: 'اللغة',
  },
  en: {
    title: 'On Air Studio', tagline: 'The live-stream prank game', play: 'Play', how: 'How to play', back: 'Back',
    proto: 'Prototype: a studio, a street and an awards night',
    how1: 'A round lasts three minutes: 90 seconds of sponsor segment, then 90 seconds interviewing Captain Barq.',
    how2: 'Joystick or arrow keys: up and down to walk, left and right to turn. Walk up to something and the action button appears (or press Space).',
    how3: 'The "Feed" screen shows what the audience sees. The sponsor segment needs camera 1 with the golden box in view. The interview needs camera 2.',
    how4: 'Someone will sabotage you: swap the product, switch the camera, kill the lights, or throw confetti. Fix it and get back to work.',
    how5: 'In the interview, ask the guest three questions. A good question raises sponsor trust, an awkward one lowers it. You need 70% to pass.',
    trust: 'Sponsor trust', live: 'ON AIR', feed: 'Feed', cam: 'Camera', need: 'Needed: camera',
    seg1: 'Sponsor segment', seg2: 'Interview',
    a_product: 'Swap product', a_console: 'Switch camera', a_light: 'Lights', a_clean: 'Clean', a_ask: 'Ask the guest',
    sp_start: 'Sponsor: I want the golden box clear on camera 1.',
    sp_product: 'Sponsor: That is a cleaner! Where is my product?', sp_camera: 'Sponsor: The audience is on the wrong camera!',
    sp_light: 'Sponsor: I can\'t see a thing! Lights on.', sp_confetti: 'Sponsor: The studio is a party. Clean it up!',
    sp_ok: 'Sponsor: That\'s better.', sp_seg2: 'Director: Interview time. Switch to camera 2 and go to the guest.',
    sp_end_great: 'Sponsor: Clean work. The next contract is yours.', sp_end_ok: 'Sponsor: We got through it. Be sharper next time.',
    sp_end_bad: 'Sponsor: My ad became a prank. We\'ll talk later.',
    guest: 'Captain Barq', iv_pick: 'Pick your question', iv_good: 'Good question', iv_meh: 'Plain question', iv_bad: 'Awkward question',
    q00: 'Which moment changed your season?', a00: 'The 90th-minute goal. I have slept next to the ball ever since.',
    q01: 'How is the weather today?', a01: 'Nice... but I came to talk football.',
    q02: 'Why did you miss that penalty?', a02: 'You brought me here to embarrass me on air?',
    q10: 'Who was the first coach to believe in you?', a10: 'My neighbourhood coach. He paid my bus fare.',
    q11: 'What did you have for breakfast?', a11: 'Eggs. Next question.',
    q12: 'Is it true you want to leave the club?', a12: 'That is gossip. Change the subject.',
    q20: 'What do you tell kids who dream of being you?', a20: 'Play every day, even if the pitch is a pavement.',
    q21: 'What is your shoe size?', a21: '43. Vital information for the audience, surely.',
    q22: 'How much do you earn?', a22: 'Ask my agent. Are we done?',
    r_pass: 'Contract passed', r_fail: 'Contract failed', r_trust: 'Sponsor trust', r_air: 'Clean airtime',
    r_coins: 'Studio coins', r_what: 'What happened on air', r_none: 'No pranks. A quiet stream.',
    r_fixed: 'fixed after', r_unfixed: 'never fixed', r_self: 'your own doing', sec: 's',
    r_iv: 'Interview', r_noq: 'question not asked',
    p_product: 'Product swap', p_camera: 'Wrong camera', p_light: 'Lights tampered', p_confetti: 'Confetti',
    customize: 'Customize character', done: 'Done', sound: 'Sound', coins: 'coins', to_menu: 'Menu', roam: 'Back to the studio',
    roam_hint: 'Walk around and talk to people. Start the stream at the control desk, or leave by the door.',
    z_studio: 'Studio', z_street: 'Street', z_event: 'Awards night',
    a_start: 'Go live', a_exit: 'Go outside', a_enter: 'Enter studio', a_event: 'Go to the awards', a_back: 'Back to street', a_talk: 'Talk', a_interview: 'Interview',
    t_skin: 'Skin', t_hair: 'Hair', t_clothes: 'Clothes', t_acc: 'Accessories',
    c_style: 'Style', c_color: 'Colour', c_beard: 'Beard', c_top: 'Top', c_bottom: 'Bottom', c_shoes: 'Shoes', c_cap: 'Cap colour',
    o_none: 'None', o_full: 'Full beard', o_goatee: 'Goatee', o_mustache: 'Moustache', o_tshirt: 'T-shirt', o_hoodie: 'Hoodie', o_jacket: 'Jacket', o_pants: 'Trousers', o_shorts: 'Shorts',
    o_cap: 'Cap', o_glasses: 'Glasses', o_headphones: 'Headphones', o_earring: 'Earring', o_chain: 'Chain', o_bracelet: 'Bracelet', o_watch: 'Watch', o_bag: 'Backpack',
    n_fan: 'Fan', n_fan1: 'You stream from that studio? Take a photo with me!', n_fan2: 'I watched yesterday. The cleaner bit was the best part.',
    n_vendor: 'Shawarma seller', n_vendor1: 'Shawarma for the host? Discount if you mention me on air.', n_vendor2: 'Your sponsor buys from me every day. Don\'t tell him I said so.',
    n_kid: 'Local kid', n_kid1: 'You know Captain Barq? Say hi from me!', n_kid2: 'When I grow up I\'ll be a host like you. Or a player. Or both.',
    n_rival: 'Rival streamer', n_rival1: 'Your studio is small. Mine has three cameras... oh, so does yours.', n_rival2: 'See you at the awards. If they let you in.',
    n_guard: 'Security', n_guard1: 'The media zone is for verified studios only. Get verified and come back.', n_guard2: 'The red carpet is open to everyone. Go ahead.',
    n_fans: 'Crowd', n_fans1: 'Barq! Barq! Barq!',
    star_s: 'Sama the singer', star_t: 'Zain the actor', iv_done: 'Interview finished',
    qs0: 'Which song changed your life?', as0: 'One I wrote in the kitchen. It hit number one in a week.',
    qs1: 'What is your favourite colour?', as1: 'Purple. Thanks for the deep question.',
    qs2: 'Is it true you lip-sync?', as2: 'Security! Where is security?',
    qt0: 'What was the hardest scene you shot?', at0: 'Crying under fake rain for ten hours.',
    qt1: 'How many films have you made?', at1: 'Count them online, champ.',
    qt2: 'Why did your last film flop?', at2: 'This interview is over.',
    again: 'Play again', menu: 'Menu', language: 'Language',
  },
};
Object.assign(STR, TR);
Object.entries(TR_SHOP).forEach(([k, v]) => { STR[k] = { ...(STR[k] || {}), ...v }; });
Object.entries(TR_DAILY).forEach(([k, v]) => { STR[k] = { ...(STR[k] || {}), ...v }; });
Object.entries(TR_PROFILE).forEach(([k, v]) => { STR[k] = { ...(STR[k] || {}), ...v }; });
Object.entries({ ...ST1, ...ST2 }).forEach(([k, arr]) => { const o = {}; ST_KEYS.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(ST3).forEach(([k, arr]) => { const o = {}; KEYS3.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TT).forEach(([k, arr]) => { const o = {}; KEYS_T.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TA).forEach(([k, arr]) => { const o = {}; KEYS_AD.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TS).forEach(([k, arr]) => { const o = {}; KEYS_S.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TI).forEach(([k, arr]) => { const o = {}; KEYS_IV.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TP).forEach(([k, arr]) => { const o = {}; KEYS_PC.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TC).forEach(([k, arr]) => { const o = {}; KEYS_CH.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TO).forEach(([k, arr]) => { const o = {}; KEYS_OBJ.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TPB).forEach(([k, arr]) => { const o = {}; KEYS_PUB.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
Object.entries(TD2).forEach(([k, arr]) => { const o = {}; KEYS_DR.forEach((key, i) => { o[key] = arr[i]; }); STR[k] = { ...(STR[k] || {}), ...o }; });
