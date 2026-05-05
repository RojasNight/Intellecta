-- Stage 7: Russian demo catalog seed data
-- Safe to rerun. Uses slugs/full names for upsert.
-- All descriptions are original demo texts, not copyrighted book text.

insert into public.genres (name, slug)
values
  ('Художественная литература', 'fiction'),
  ('Психология', 'psychology'),
  ('Бизнес', 'business'),
  ('Наука', 'science'),
  ('Философия', 'philosophy'),
  ('Образование', 'education'),
  ('Технологии', 'technology')
on conflict (slug) do update set name = excluded.name, updated_at = now();

insert into public.authors (full_name, bio)
values
  ('А. Соколов', 'Автор эссе о цифровой культуре и идентичности.'),
  ('М. Виноградова', 'Практический психолог и исследователь выбора.'),
  ('И. Левин', 'Популяризатор когнитивной науки.'),
  ('Е. Голубева', 'Редактор научно-популярных изданий.'),
  ('Д. Кравцов', 'Консультант по лидерству и организационной культуре.'),
  ('П. Гордеев', 'Аналитик технологий и этики искусственного интеллекта.'),
  ('Н. Заречная', 'Автор камерной прозы о переменах и внутренней свободе.'),
  ('С. Орлова', 'Специалист по устойчивой продуктивности.'),
  ('В. Миронов', 'Преподаватель философии и автор образовательных курсов.'),
  ('К. Полякова', 'Исследователь образовательных практик.'),
  ('Р. Тимофеев', 'Технологический обозреватель.'),
  ('Л. Нестерова', 'Писательница и эссеистка.'),
  ('Ю. Беляев', 'Автор книг о мышлении и коммуникации.'),
  ('О. Романова', 'Бизнес-тренер и методолог обучения взрослых.')
on conflict (full_name) do update set bio = excluded.bio, updated_at = now();

with data(title, slug, author_names, genre_slugs, description, price, format, cover_url, stock_qty, rating, summary, topics, keywords, complexity, tone) as (
  values
  ('Цифровая идентичность', 'tsifrovaya-identichnost', array['А. Соколов'], array['philosophy','technology'], 'Размышления о том, как формируется личность в эпоху социальных сетей, алгоритмов и постоянной публичности.', 690.00, 'paper', null, 12, 4.60, 'Книга исследует, как цифровая среда меняет автономию, приватность и ощущение собственной личности.', '[]'::jsonb || '"цифровое общество"'::jsonb || '"идентичность"'::jsonb || '"этика"'::jsonb, '[]'::jsonb || '"алгоритмы"'::jsonb || '"приватность"'::jsonb || '"самоопределение"'::jsonb, 2, 'Размышляющий, спокойный'),
  ('Тонкое искусство выбора', 'tonkoe-iskusstvo-vybora', array['М. Виноградова'], array['psychology'], 'Практическое исследование того, как мы принимаем решения и как научиться выбирать осознанно.', 540.00, 'ebook', null, 0, 4.40, 'Понятное введение в когнитивные искажения и осознанные решения без перегрузки терминами.', '[]'::jsonb || '"психология выбора"'::jsonb || '"саморазвитие"'::jsonb, '[]'::jsonb || '"решения"'::jsonb || '"осознанность"'::jsonb, 1, 'Поддерживающий'),
  ('Архитектура мышления', 'arkhitektura-myshleniya', array['И. Левин','Е. Голубева'], array['science','psychology'], 'Книга о внимании, памяти, воображении и связи между ними на основе современных исследований когнитивистики.', 820.00, 'paper', null, 7, 4.80, 'Доступный обзор когнитивной науки с упражнениями для развития критического мышления.', '[]'::jsonb || '"познание"'::jsonb || '"критическое мышление"'::jsonb, '[]'::jsonb || '"внимание"'::jsonb || '"память"'::jsonb || '"когнитивистика"'::jsonb, 2, 'Любознательный'),
  ('Лидеры без пафоса', 'lidery-bez-pafosa', array['Д. Кравцов'], array['business'], 'Истории руководителей небольших компаний, которые строят культуру доверия без громких лозунгов.', 720.00, 'audiobook', null, 25, 4.30, 'Сборник кейсов о спокойном лидерстве, доверии и командной ответственности.', '[]'::jsonb || '"лидерство"'::jsonb || '"будущее работы"'::jsonb, '[]'::jsonb || '"команды"'::jsonb || '"доверие"'::jsonb, 1, 'Вдохновляющий'),
  ('Алгоритмы и смысл', 'algoritmy-i-smysl', array['П. Гордеев'], array['technology','philosophy'], 'Книга о границах искусственного интеллекта и вопросах, которые общество задает технологиям.', 950.00, 'paper', null, 4, 4.70, 'Сбалансированный взгляд на возможности и ограничения ИИ, автоматизацию и этические дилеммы.', '[]'::jsonb || '"искусственный интеллект"'::jsonb || '"этика"'::jsonb, '[]'::jsonb || '"ИИ"'::jsonb || '"автоматизация"'::jsonb, 3, 'Аналитический'),
  ('Книга о тишине', 'kniga-o-tishine', array['Н. Заречная'], array['fiction'], 'Тихий роман о переезде из мегаполиса в северный город и попытке пересобрать жизнь.', 480.00, 'paper', null, 18, 4.50, 'Камерная история о внутренней свободе, одиночестве и принятии перемен.', '[]'::jsonb || '"личностный рост"'::jsonb || '"одиночество"'::jsonb, '[]'::jsonb || '"перемены"'::jsonb || '"внутренний мир"'::jsonb, 1, 'Меланхоличный, тёплый'),
  ('Практика продуктивности', 'praktika-produktivnosti', array['С. Орлова'], array['business','psychology'], 'Спокойный взгляд на продуктивность: как делать важное без выгорания и гонки достижений.', 590.00, 'ebook', null, 32, 4.20, 'Практики устойчивого ритма, планирования и восстановления внимания.', '[]'::jsonb || '"продуктивность"'::jsonb || '"саморазвитие"'::jsonb, '[]'::jsonb || '"фокус"'::jsonb || '"выгорание"'::jsonb, 1, 'Практичный'),
  ('Философия простых вопросов', 'filosofiya-prostyh-voprosov', array['В. Миронов'], array['philosophy','education'], 'Введение в философское мышление через вопросы о свободе, знании, счастье и ответственности.', 610.00, 'paper', null, 14, 4.35, 'Мягкий вход в философию для читателей, которые хотят рассуждать ясно и спокойно.', '[]'::jsonb || '"философия"'::jsonb || '"критическое мышление"'::jsonb, '[]'::jsonb || '"свобода"'::jsonb || '"ответственность"'::jsonb, 2, 'Спокойный'),
  ('Учиться глубоко', 'uchitsya-gluboko', array['К. Полякова'], array['education','psychology'], 'Книга о том, как учиться без механического заучивания: вопросы, заметки, практика и повторение.', 560.00, 'ebook', null, 21, 4.55, 'Методика глубокого обучения с акцентом на понимание и перенос знаний.', '[]'::jsonb || '"образование"'::jsonb || '"познание"'::jsonb, '[]'::jsonb || '"обучение"'::jsonb || '"память"'::jsonb, 2, 'Поддерживающий'),
  ('Код будущего', 'kod-budushchego', array['Р. Тимофеев'], array['technology'], 'Обзор технологических трендов: ИИ, интерфейсы, автоматизация, данные и новые профессии.', 780.00, 'paper', null, 9, 4.10, 'Книга помогает понять технологические изменения без лишнего футуризма.', '[]'::jsonb || '"технологии"'::jsonb || '"будущее работы"'::jsonb, '[]'::jsonb || '"данные"'::jsonb || '"автоматизация"'::jsonb, 2, 'Деловой'),
  ('Дом на краю карты', 'dom-na-krayu-karty', array['Л. Нестерова'], array['fiction'], 'Роман о семье, памяти и доме, который неожиданно становится точкой возвращения.', 520.00, 'paper', null, 11, 4.25, 'Тёплая художественная история о семье, выборе и восстановлении связей.', '[]'::jsonb || '"семья"'::jsonb || '"память"'::jsonb, '[]'::jsonb || '"дом"'::jsonb || '"возвращение"'::jsonb, 1, 'Тёплый'),
  ('Ясные аргументы', 'yasnye-argumenty', array['Ю. Беляев'], array['education','business'], 'Практическая книга о том, как строить понятные доводы, обсуждать идеи и не терять смысл в споре.', 640.00, 'ebook', null, 16, 4.45, 'Инструменты аргументации, ясной коммуникации и уважительного обсуждения сложных тем.', '[]'::jsonb || '"коммуникация"'::jsonb || '"критическое мышление"'::jsonb, '[]'::jsonb || '"аргументы"'::jsonb || '"диалог"'::jsonb, 2, 'Собранный'),
  ('Команды, которые учатся', 'komandy-kotorye-uchatsya', array['О. Романова'], array['business','education'], 'О том, как компании развивают людей через обратную связь, эксперименты и культуру обучения.', 730.00, 'paper', null, 8, 4.50, 'Книга для руководителей о среде, где обучение становится частью работы.', '[]'::jsonb || '"лидерство"'::jsonb || '"образование"'::jsonb, '[]'::jsonb || '"обратная связь"'::jsonb || '"команды"'::jsonb, 2, 'Практичный'),
  ('Нейросети без магии', 'neyroseti-bez-magii', array['П. Гордеев','Р. Тимофеев'], array['technology','science'], 'Понятное объяснение нейросетей, данных, ограничений моделей и типичных ошибок ожиданий.', 880.00, 'paper', null, 6, 4.75, 'Разбор ИИ без мистификации: как работают модели и где важно человеческое решение.', '[]'::jsonb || '"искусственный интеллект"'::jsonb || '"наука"'::jsonb, '[]'::jsonb || '"нейросети"'::jsonb || '"данные"'::jsonb, 3, 'Объясняющий'),
  ('Медленное чтение', 'medlennoe-chtenie', array['К. Полякова'], array['education','fiction'], 'Эссе о внимательном чтении, заметках на полях и возвращении к сложным текстам.', 490.00, 'paper', null, 19, 4.15, 'Книга о практиках чтения, которые помогают видеть структуру, стиль и смысл.', '[]'::jsonb || '"чтение"'::jsonb || '"образование"'::jsonb, '[]'::jsonb || '"заметки"'::jsonb || '"внимание"'::jsonb, 1, 'Созерцательный'),
  ('Этика повседневных решений', 'etika-povsednevnyh-resheniy', array['В. Миронов'], array['philosophy','psychology'], 'Как принимать маленькие решения, когда у каждого выбора есть последствия для других людей.', 670.00, 'ebook', null, 10, 4.40, 'Прикладной взгляд на этику без морализаторства, через бытовые и рабочие ситуации.', '[]'::jsonb || '"этика"'::jsonb || '"психология выбора"'::jsonb, '[]'::jsonb || '"ценности"'::jsonb || '"ответственность"'::jsonb, 2, 'Размышляющий'),
  ('Город после дождя', 'gorod-posle-dozhdya', array['Н. Заречная'], array['fiction'], 'Лирический роман о городе, который меняется вместе с людьми, решившими начать заново.', 530.00, 'audiobook', null, 13, 4.30, 'Художественная история о переменах, надежде и тихих разговорах с собой.', '[]'::jsonb || '"личностный рост"'::jsonb || '"перемены"'::jsonb, '[]'::jsonb || '"город"'::jsonb || '"надежда"'::jsonb, 1, 'Лиричный'),
  ('Данные и доверие', 'dannye-i-doverie', array['А. Соколов','П. Гордеев'], array['technology','business'], 'Почему компании собирают данные, как объяснять это пользователям и где проходит граница доверия.', 920.00, 'paper', null, 5, 4.65, 'Книга о прозрачности, приватности и ответственности цифровых сервисов.', '[]'::jsonb || '"цифровое общество"'::jsonb || '"доверие"'::jsonb, '[]'::jsonb || '"приватность"'::jsonb || '"данные"'::jsonb, 3, 'Аналитический'),
  ('Учебник спокойного руководителя', 'uchebnik-spokoynogo-rukovoditelya', array['Д. Кравцов','О. Романова'], array['business'], 'Пособие для руководителей, которые хотят управлять процессами без давления и хаоса.', 760.00, 'paper', null, 17, 4.55, 'Практики планирования, обратной связи и устойчивой командной коммуникации.', '[]'::jsonb || '"лидерство"'::jsonb || '"продуктивность"'::jsonb, '[]'::jsonb || '"менеджмент"'::jsonb || '"коммуникация"'::jsonb, 2, 'Уверенный'),
  ('Научиться думать медленнее', 'nauchitsya-dumat-medlennee', array['И. Левин'], array['science','psychology'], 'О том, как замедление помогает лучше видеть причины, проверять гипотезы и не спешить с выводами.', 700.00, 'ebook', null, 15, 4.70, 'Научно-популярный текст о внимании, ошибках мышления и интеллектуальной дисциплине.', '[]'::jsonb || '"критическое мышление"'::jsonb || '"познание"'::jsonb, '[]'::jsonb || '"мышление"'::jsonb || '"гипотезы"'::jsonb, 2, 'Собранный')
), upserted_books as (
  insert into public.books (title, slug, description, price, format, cover_url, stock_qty, rating, is_active)
  select title, slug, description, price, format, cover_url, stock_qty, rating, true
  from data
  on conflict (slug) do update set
    title = excluded.title,
    description = excluded.description,
    price = excluded.price,
    format = excluded.format,
    cover_url = excluded.cover_url,
    stock_qty = excluded.stock_qty,
    rating = excluded.rating,
    is_active = true,
    updated_at = now()
  returning id, slug
), all_books as (
  select b.id, b.slug, d.author_names, d.genre_slugs, d.summary, d.topics, d.keywords, d.complexity, d.tone
  from public.books b
  join data d on d.slug = b.slug
)
insert into public.book_ai_profiles (book_id, summary, topics, keywords, complexity_level, emotional_tone, status, updated_at)
select id, summary, topics, keywords, complexity, tone, 'ready', now()
from all_books
on conflict (book_id) do update set
  summary = excluded.summary,
  topics = excluded.topics,
  keywords = excluded.keywords,
  complexity_level = excluded.complexity_level,
  emotional_tone = excluded.emotional_tone,
  status = 'ready',
  updated_at = now();

-- Recreate relations deterministically for seeded slugs only.
with seeded as (
  select b.id as book_id, d.author_names, d.genre_slugs
  from public.books b
  join (values
    ('tsifrovaya-identichnost', array['А. Соколов'], array['philosophy','technology']),
    ('tonkoe-iskusstvo-vybora', array['М. Виноградова'], array['psychology']),
    ('arkhitektura-myshleniya', array['И. Левин','Е. Голубева'], array['science','psychology']),
    ('lidery-bez-pafosa', array['Д. Кравцов'], array['business']),
    ('algoritmy-i-smysl', array['П. Гордеев'], array['technology','philosophy']),
    ('kniga-o-tishine', array['Н. Заречная'], array['fiction']),
    ('praktika-produktivnosti', array['С. Орлова'], array['business','psychology']),
    ('filosofiya-prostyh-voprosov', array['В. Миронов'], array['philosophy','education']),
    ('uchitsya-gluboko', array['К. Полякова'], array['education','psychology']),
    ('kod-budushchego', array['Р. Тимофеев'], array['technology']),
    ('dom-na-krayu-karty', array['Л. Нестерова'], array['fiction']),
    ('yasnye-argumenty', array['Ю. Беляев'], array['education','business']),
    ('komandy-kotorye-uchatsya', array['О. Романова'], array['business','education']),
    ('neyroseti-bez-magii', array['П. Гордеев','Р. Тимофеев'], array['technology','science']),
    ('medlennoe-chtenie', array['К. Полякова'], array['education','fiction']),
    ('etika-povsednevnyh-resheniy', array['В. Миронов'], array['philosophy','psychology']),
    ('gorod-posle-dozhdya', array['Н. Заречная'], array['fiction']),
    ('dannye-i-doverie', array['А. Соколов','П. Гордеев'], array['technology','business']),
    ('uchebnik-spokoynogo-rukovoditelya', array['Д. Кравцов','О. Романова'], array['business']),
    ('nauchitsya-dumat-medlennee', array['И. Левин'], array['science','psychology'])
  ) as d(slug, author_names, genre_slugs) on d.slug = b.slug
), author_links as (
  select s.book_id, a.id as author_id
  from seeded s
  cross join unnest(s.author_names) as an(full_name)
  join public.authors a on a.full_name = an.full_name
), genre_links as (
  select s.book_id, g.id as genre_id
  from seeded s
  cross join unnest(s.genre_slugs) as gs(slug)
  join public.genres g on g.slug = gs.slug
)
insert into public.book_authors (book_id, author_id)
select book_id, author_id from author_links
on conflict do nothing;

with seeded as (
  select b.id as book_id, d.genre_slugs
  from public.books b
  join (values
    ('tsifrovaya-identichnost', array['philosophy','technology']), ('tonkoe-iskusstvo-vybora', array['psychology']),
    ('arkhitektura-myshleniya', array['science','psychology']), ('lidery-bez-pafosa', array['business']),
    ('algoritmy-i-smysl', array['technology','philosophy']), ('kniga-o-tishine', array['fiction']),
    ('praktika-produktivnosti', array['business','psychology']), ('filosofiya-prostyh-voprosov', array['philosophy','education']),
    ('uchitsya-gluboko', array['education','psychology']), ('kod-budushchego', array['technology']),
    ('dom-na-krayu-karty', array['fiction']), ('yasnye-argumenty', array['education','business']),
    ('komandy-kotorye-uchatsya', array['business','education']), ('neyroseti-bez-magii', array['technology','science']),
    ('medlennoe-chtenie', array['education','fiction']), ('etika-povsednevnyh-resheniy', array['philosophy','psychology']),
    ('gorod-posle-dozhdya', array['fiction']), ('dannye-i-doverie', array['technology','business']),
    ('uchebnik-spokoynogo-rukovoditelya', array['business']), ('nauchitsya-dumat-medlennee', array['science','psychology'])
  ) as d(slug, genre_slugs) on d.slug = b.slug
), genre_links as (
  select s.book_id, g.id as genre_id
  from seeded s
  cross join unnest(s.genre_slugs) as gs(slug)
  join public.genres g on g.slug = gs.slug
)
insert into public.book_genres (book_id, genre_id)
select book_id, genre_id from genre_links
on conflict do nothing;
