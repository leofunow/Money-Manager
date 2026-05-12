/**
 * Rule-based categorization — works offline without any API.
 * Matches merchant names and descriptions against keyword patterns.
 */
const RULES: Array<{ keywords: RegExp; category: string }> = [
  // Food & Groceries
  { keywords: /пятёрочк|пятерочк|pyaterochka|magnit|магнит|ашан|auchan|лента|perekrestok|перекрёст|metro|метро|вкусвилл|vkusvill|дикси|dixie|окей|okey|spar|спар|глобус|globus|fix price|фикс прайс/i, category: "Еда и продукты" },
  // Cafes & Restaurants
  { keywords: /kfc|мак|mcdonalds|macdonald|бургер|burger|пицца|pizza|кофе|coffee|starbucks|старбакс|шаурма|shawarma|суши|sushi|dominos|домино|wok|вок|cafe|кафе|ресторан|resto|яндекс еда|yandex food|delivery club|самокат|яндекс лавка/i, category: "Кафе и рестораны" },
  // Transport
  { keywords: /яндекс такси|uber|ситимобил|gett|такси|taxi|метро|metro|мцк|мцд|электричка|аэроэкспресс|аэр.экспресс|transcard|транскарт|тройка|troika/i, category: "Транспорт" },
  // Utilities & Communication
  { keywords: /мтс|mts|билайн|beeline|мегафон|megafon|теле2|tele2|ростелеком|ростеле|mos.ru|мосэнерг|горгаз|гкх|жкх|домофон|internet|интернет|провайдер/i, category: "ЖКХ и связь" },
  // Healthcare
  { keywords: /аптека|pharmacy|apteka|доктор|clinic|клиника|больница|hospital|medic|медицин|здоровье|стоматолог|стомат|lab|лаборатор|invitro|инвитро/i, category: "Здоровье" },
  // Clothing & Shopping
  { keywords: /zara|h&m|hm|uniqlo|юникло|gloria jeans|gloria jean|wildberries|вайлдберри|ozon|озон|lamoda|ламода|одежд|fashion|fashion|sportmaster|спортмастер|decathlon|декатлон/i, category: "Одежда" },
  // Entertainment
  { keywords: /кино|cinema|film|netflix|нетфликс|okko|окко|spotify|ivi|иви|steam|стим|playstation|xbox|театр|музей|museum|concert|концерт/i, category: "Развлечения" },
  // Sports
  { keywords: /фитнес|fitness|gym|спорт|sport|planet|fitness|бассейн|pool|yoga|йога|crossfit|кроссфит/i, category: "Спорт" },
  // Education
  { keywords: /skillbox|скилбокс|coursera|udemy|яндекс практикум|yandex practicum|geekbrains|гикбрейнс|нетология|netology|universit|университет|институт|школ|school/i, category: "Образование" },
  // Travel
  { keywords: /aviasales|авиасейлс|booking|bookcom|airbnb|аэрофлот|aeroflot|s7|ural airlines|уральск|аэропорт|airport|отель|hotel|hostel|хостел/i, category: "Путешествия" },
  // Income
  { keywords: /зарплата|salary|оклад|аванс|payroll|перевод|пополнение|cashback|кэшбэк|начислен/i, category: "Зарплата" },
];

export function categorizeByRules(text: string): string | null {
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.test(lower)) return rule.category;
  }
  return null;
}
