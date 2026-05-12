const RULES: Array<{ keywords: RegExp; category: string }> = [
  // Food & Groceries
  {
    keywords: /пятёрочк|пятерочк|pyaterochka|pyat[ei]rochk|magnit|магнит|ашан|auchan|лента|lenta|perekrestok|перекрёст|перекрест|metro cash|метро|вкусвилл|vkusvill|diksi|дикси|dixie|o[ck]ey|окей|spar|спар|глобус|globus|fix.?price|фикс.?прайс|атак|atak|бигсити|bigsiti|верный|vernyi|самокат|samokat|chizhik|чижик|igora|игора|красное.?белое|krasnoe/i,
    category: "Еда и продукты",
  },
  // Cafes & Restaurants
  {
    keywords: /kfc|кфс|mcdon|макдон|burger.?king|бургер|papa.?john|папа.?джон|pizza|пицц|coffee|кофе|starbucks|старбакс|шаурм|shawarma|суши|sushi|dominos|домино|wok|вок|cafe|кафе|ресторан|resto|яндекс.?еда|yandex.?food|ya\.eda|delivery.?club|food.?delivery|sbarro|сбарро|теремок|teremok|subway|сабвей|cinnabon|cinnabon|krispy|чайхан/i,
    category: "Кафе и рестораны",
  },
  // Transport
  {
    keywords: /яндекс.?такси|yandex.?taxi|ya\.taxi|uber|ситимобил|citymobil|gett|такси|taxi|метрополит|metro(?!.?cash)|мцк|мцд|электричк|аэроэкспресс|transcard|транскарт|тройка|troika|russpass|ряд.?авто|rzd|ржд|аэрофлот|aeroflot|s7\.ru|rossiya|utair|pobeda|pegas|pegast|ural.?air|ж\.?д|жд.?билет|железнодор|railway|train/i,
    category: "Транспорт",
  },
  // Utilities & Communication
  {
    keywords: /мтс(?!\.ru)|mts(?!\.ru)|билайн|beeline|мегафон|megafon|теле2|tele2|ростелеком|ростеле|mos\.ru|мосэнерг|горгаз|жку|жкх|домофон|интернет|провайдер|rostelecom|yota|йота|сбербанк онлайн.*жкх|эр-телеком|ер.телеком|ttk/i,
    category: "ЖКХ и связь",
  },
  // Healthcare
  {
    keywords: /аптека|pharmacy|apteka|доктор|clinic|клиника|больниц|hospital|medic|медицин|здоровь|стоматолог|стомат|лаборатор|invitro|инвитро|гемотест|hemotest|ситилаб|citilab|эмеральд|emerald|ригла|rigla|36\.?6|горздрав|gordzdrav|асна|asna|живика/i,
    category: "Здоровье",
  },
  // Clothing & Shopping
  {
    keywords: /zara|h&m|\bhm\b|uniqlo|юникло|gloria.?jean|wildberries|вайлдберри|wb\.ru|ozon|озон|lamoda|ламода|одежд|fashion|sportmaster|спортмастер|decathlon|декатлон|модис|modis|befree|бефри|ostin|остин|твое|твоё|desam|desam|henderson|henderson|mexx|mexx|colin|colin|familia|фамилия/i,
    category: "Одежда",
  },
  // Entertainment
  {
    keywords: /кино|cinema|film|netflix|нетфликс|okko|окко|spotify|ivi|иви|steam|стим|playstation|xbox|театр|музей|museum|concert|концерт|мегапарк|megapark|парк|develop|геймс|games|itunes|apple.com\/bill|google.play|app.store|kinopoisk|кинопоиск/i,
    category: "Развлечения",
  },
  // Sports
  {
    keywords: /фитнес|fitness|gym|планет|planet|бассейн|pool|yoga|йога|crossfit|кроссфит|world.class|worldclass|физра|спорт.?зал|спортзал|reebok|nike|adidas/i,
    category: "Спорт",
  },
  // Education
  {
    keywords: /skillbox|скилбокс|coursera|udemy|яндекс.?практикум|yandex.practicum|geekbrains|гикбрейнс|нетология|netology|universit|университет|институт|школ(?!ьник)|school|stepik|стэпик|foxford|фоксфорд/i,
    category: "Образование",
  },
  // Travel
  {
    keywords: /aviasales|авиасейлс|booking\.com|airbnb|аэрофлот|aeroflot|\bs7\b|ural.?airlines|аэропорт|airport|отель|hotel|hostel|хостел|туроператор|touroperator|ozon.travel|travel/i,
    category: "Путешествия",
  },
  // Gifts
  {
    keywords: /цветы|flowers|florist|букет|подарок|gift|flowwow|flawwow|bloomsybox/i,
    category: "Подарки",
  },
  // Income
  {
    keywords: /зарплата|salary|оклад|аванс|payroll|пополнение.?счет|пополнение.?карт|cashback|кэшбэк|начислен|procent|процент|дивиденд|dividend|депозит|deposit/i,
    category: "Зарплата",
  },
];

export function categorizeByRules(text: string): string | null {
  // Normalize: remove common prefixes from T-Bank statements
  const normalized = text
    .replace(/^(оплата|перевод|покупка|списание|оплата по карте)[:\s]*/i, "")
    .replace(/^(ооо|оао|ип|пао|зао|nko)\s+/i, "")
    .replace(/\*\d+$/, "")
    .trim();

  const lower = normalized.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.test(lower)) return rule.category;
  }

  // Try on original text if normalized didn't match
  const origLower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.test(origLower)) return rule.category;
  }

  return null;
}
