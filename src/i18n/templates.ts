import { partName, type Part, type TemplateSpec } from "../engine/template";
import { currentLang } from "./index";

// Ukrainian for the bundled templates: their names, hints, the text they put
// on the photo and the names of their parts in the Overlays list. Anything not
// listed here (numbers, prices, times) stays as it is.
const UK: Record<string, string> = {
  // groups
  Property: "Нерухомість", Maps: "Карти", Social: "Соцмережі", Guides: "Інструкції",
  // names
  "Room tour": "Огляд кімнат", "Room sizes": "Площі кімнат", "Walk-through": "Прохід квартирою", Furniture: "Меблі", Remodel: "Перепланування", "Key feature": "Головна перевага", Dimensions: "Розміри", Listing: "Оголошення", "Day & night": "День і ніч", "Light & views": "Світло й краєвиди",
  "Route A → B": "Маршрут A → B", Stops: "Зупинки", "You are here": "Ви тут", Territory: "Територія", "What's nearby": "Що поруч", Radius: "Радіус", "How to get here": "Як дістатись", Parking: "Паркування", "Two routes": "Два маршрути", "Day plan": "План дня", "Delivery zones": "Зони доставки", "Meeting point": "Місце зустрічі", "Road closed": "Дорогу перекрито",
  "Intro & outro": "Початок і кінець", "Title card": "Заголовок", "Price tag": "Цінник", Sale: "Знижка", Review: "Відгук", "Call to action": "Заклик до дії", "Three reasons": "Три причини", "Your handle": "Ваш нік", "New arrival": "Новинка", "More photos": "Ще фото", "Name plate": "Ім'я та посада",
  "Steps 1-2-3": "Кроки 1-2-3", "Tap here": "Натисніть тут", Callouts: "Виноски", "Click path": "Шлях кліків", "What's new": "Що нового", "Guided tour": "Екскурсія екраном", Remarks: "Зауваження", "Do / Don't": "Так / Не так", Warning: "Попередження", "Compare A / B": "Порівняння A / B", Evacuation: "Евакуація",
  // hints
  "Rooms light up one after another, each with its name": "Кімнати підсвічуються одна за одною, кожна з назвою",
  "Square metres in each room and the total": "Площа кожної кімнати й загальна",
  "A route from the front door through the rooms": "Маршрут від вхідних дверей кімнатами",
  "Plan symbols that appear one by one": "Позначки меблів, що з'являються по черзі",
  "What goes and what is new": "Що прибирають і що нове",
  "A spotlight on one place and a caption": "Підсвічене місце й підпис",
  "Measure lines with numbers along the walls": "Розмірні лінії з числами вздовж стін",
  "What it is, the price and what to do next": "Що це, ціна і що робити далі",
  "Two parts of the home in two colours": "Дві частини житла двома кольорами",
  "Arrows at the windows: where the sun and the view are": "Стрілки біля вікон: де сонце і який краєвид",
  "Two points and a line drawn along the streets": "Дві точки й лінія вулицями між ними",
  "Numbered stops joined one after another": "Пронумеровані зупинки, з'єднані по черзі",
  "A pulsing marker with a label": "Маркер, що пульсує, з підписом",
  "An outlined area with its name": "Обведена ділянка з назвою",
  "Your place in the middle, what is around it and how far": "Ваше місце в центрі, що довкола і як далеко",
  "Rings around a point: delivery zone, a five-minute walk": "Кола довкола точки: зона доставки, п'ять хвилин пішки",
  "From the stop to your door, with the walking time": "Від зупинки до дверей, із часом пішки",
  "Where to park and where the way in is": "Де паркуватись і де заїзд",
  "The fast way and the other way, each with its time": "Швидкий шлях та інший, кожен зі своїм часом",
  "Places in order, each with its time": "Місця по черзі, кожне зі своїм часом",
  "Districts in different colours with a price on each": "Райони різними кольорами, на кожному ціна",
  "A pin on the spot, with the time": "Мітка на місці й час",
  "The closed stretch and the way around it": "Перекрита ділянка та об'їзд",
  "A title at the start and a closing line at the end": "Заголовок на початку й завершальний рядок у кінці",
  "A name and one line under it, bottom left": "Назва й рядок під нею, внизу ліворуч",
  "The price, large, in the corner": "Ціна, великим, у кутку",
  "A discount that pulses, with the deadline": "Знижка, що пульсує, і термін",
  "Five stars, a quote and who said it": "П'ять зірок, цитата й автор",
  "A button-like line at the bottom that pulses": "Рядок-кнопка внизу, що пульсує",
  "A tick and a short line, three times": "Галочка й короткий рядок, тричі",
  "Your name in the corner for the whole video": "Ваше ім'я в кутку на все відео",
  "A ring around the new thing and a tag next to it": "Коло довкола новинки й ярлик поруч",
  "An arrow that runs to the right: swipe on": "Стрілка праворуч: гортайте далі",
  "Who is speaking: a name and a role, then gone": "Хто говорить: ім'я й посада, потім зникає",
  "Numbered steps with a line of text each": "Пронумеровані кроки, кожен із рядком тексту",
  "A pulsing spot on a button and a hint": "Пляма, що пульсує на кнопці, і підказка",
  "A dot, a leader line and a note, three times": "Точка, лінія й примітка, тричі",
  "Where to click, in order, joined by arrows": "Куди клікати, по черзі, зі стрілками",
  "A frame around the new part and what it does": "Рамка довкола нового й що воно робить",
  "One part of the screen at a time, each with its name": "Частини екрана по одній, кожна з назвою",
  "Circled problems, numbered": "Обведені проблеми з номерами",
  "A tick on the right way and a cross on the wrong one": "Галочка на правильному, хрестик на хибному",
  "A circle, a warning mark and a line of text": "Коло, знак оклику й рядок тексту",
  "Two options side by side": "Два варіанти поруч",
  "Where you are and the way out": "Де ви і де вихід",
  // text on the photo
  "Living room": "Вітальня", Kitchen: "Кухня", Bedroom: "Спальня", Bath: "Ванна",
  "19 m²": "19 м²", "12 m²": "12 м²", "11 m²": "11 м²", "5 m²": "5 м²", "47 m² total": "Разом 47 м²",
  Remove: "Прибрати", New: "Нове", "Panoramic windows": "Панорамні вікна", "4.60 m": "4,60 м", "3.50 m": "3,50 м",
  "2 rooms · 47 m²": "2 кімнати · 47 м²", "47 m² · 2 rooms": "47 м² · 2 кімнати", "Book a viewing": "Записатись на огляд",
  "Morning sun": "Сонце зранку", "Evening sun": "Сонце ввечері", "Park view": "Вид на парк",
  "12 min": "12 хв", "5 min": "5 хв", "2 min": "2 хв", "8 min": "8 хв", "3 min": "3 хв", "5 min walk": "5 хв пішки", "4 min walk": "4 хв пішки",
  "Plot 14 · 0.6 ha": "Ділянка 14 · 0,6 га", "We are here": "Ми тут", "Way in": "Заїзд", "24 spaces · free": "24 місця · вільно",
  "10:00 Museum": "10:00 Музей", "12:30 Lunch": "12:30 Обід", "15:00 Park": "15:00 Парк", Free: "Безкоштовно", "Meet here · 18:00": "Зустріч тут · 18:00",
  Closed: "Перекрито", Detour: "Об'їзд",
  "Apartment tour": "Огляд квартири", "Riverside 12": "Набережна, 12", "For sale": "Продаж", "This week only": "Лише цього тижня",
  "“Felt like home”": "«Як удома»", "Anna, guest": "Анна, гостя", "Link in bio": "Посилання в профілі",
  "Sunny side": "Сонячний бік", "Park nearby": "Парк поруч", "New kitchen": "Нова кухня", "@yourname": "@ваш_нік",
  "Anna Kovalenko": "Анна Коваленко", "Real estate agent": "Агентка з нерухомості",
  "Open reports": "Відкрийте звіти", "Pick a month": "Оберіть місяць", "Press Export": "Натисніть Експорт",
  "Best month": "Найкращий місяць", Revenue: "Дохід", "Latest orders": "Останні замовлення", "One-click export": "Експорт в один клік",
  Menu: "Меню", "Sales by month": "Продажі за місяцями", Export: "Експорт", Do: "Так", "Don't": "Не так", "Check this first": "Спершу перевірте",
  "Option A": "Варіант A", "Option B": "Варіант B",
  // part names in the Overlays list
  "Living room zone": "Зона вітальні", "Kitchen zone": "Зона кухні", "Bedroom zone": "Зона спальні", "Bath zone": "Зона ванної",
  "Front door": "Вхідні двері", Route: "Маршрут", Sofa: "Диван", Table: "Стіл", Bed: "Ліжко", "Wall to remove": "Стіна під знесення", "New storage": "Нова комора",
  Spotlight: "Підсвітка", Price: "Ціна", "Day zone": "Денна зона", "Night zone": "Нічна зона", Pulse: "Пульс", Marker: "Маркер", Area: "Ділянка",
  "Home plate": "Основа дому", Home: "Дім", School: "Школа", Shop: "Магазин", Park: "Парк", "Bus stop": "Зупинка", Tree: "Дерево", Bus: "Автобус",
  "Outer ring": "Зовнішнє коло", "Middle ring": "Середнє коло", "Inner ring": "Внутрішнє коло", Centre: "Центр", Walk: "Шлях пішки", "Car park": "Стоянка",
  "Fast route": "Швидкий маршрут", "Other route": "Інший маршрут", Start: "Старт", Finish: "Фініш", West: "Захід", East: "Схід", "Closed stretch": "Перекрита ділянка",
  Title: "Заголовок", Subtitle: "Підзаголовок", Discount: "Знижка", Quote: "Цитата", Author: "Автор", Handle: "Нік", Ring: "Коло", Tag: "Ярлик", Name: "Ім'я", Role: "Посада",
  "Tap spot": "Місце дотику", Frame: "Рамка", "Menu frame": "Рамка меню", "Chart frame": "Рамка графіка", "Export frame": "Рамка експорту",
  "Right way": "Правильно", "Wrong way": "Хибно", Tick: "Галочка", Cross: "Хрестик", Circle: "Коло", "Warning sign": "Знак оклику", "Side A": "Бік A", "Side B": "Бік B",
  "Way out": "Шлях до виходу", You: "Ви", Exit: "Вихід", Pin: "Мітка", Zone: "Зона", Point: "Точка", Line: "Лінія", Arrow: "Стрілка", Text: "Текст",
};
const NUMBERED: [RegExp, string][] = [[/^Star (\d+)$/, "Зірка $1"], [/^Plate (\d+)$/, "Основа $1"], [/^Tick (\d+)$/, "Галочка $1"], [/^Badge (.*)$/, "Значок $1"]];

/** A template text in the current language (unchanged in English, or when there is no translation). */
export function templateText(text: string): string {
  if (currentLang() !== "uk") return text;
  if (Object.hasOwn(UK, text)) return UK[text];
  for (const [pattern, to] of NUMBERED) if (pattern.test(text)) return text.replace(pattern, to);
  return text;
}

/** A bundled template with its name, hint, texts and part names in the current language. Its `group` stays as the English id. */
export function localizeTemplate(spec: TemplateSpec): TemplateSpec {
  if (currentLang() !== "uk") return spec;
  const parts = spec.parts.map((part): Part => {
    const out = { ...part, name: templateText(part.name ?? partName(part)) } as Part;
    if (out.set) out.set = templateText(out.set);
    if ("text" in out) out.text = templateText(out.text);
    if ("label" in out && out.label) out.label = templateText(out.label);
    return out;
  });
  return { ...spec, name: templateText(spec.name), hint: templateText(spec.hint), parts };
}
