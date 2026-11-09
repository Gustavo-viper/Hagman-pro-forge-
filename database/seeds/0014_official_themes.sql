-- Official theme songs chosen by Forge Studios (YouTube embeds; only fills universes not set yet).
UPDATE universe_settings s SET official_theme = v.theme
  FROM (VALUES
    ('harry-potter',  '{"youtubeId":"Nhg2ZXngfkM","title":"Hedwig''s Theme","artist":"John Williams"}'::jsonb),
    ('supernatural',  '{"youtubeId":"lCAGnZimVF0","title":"Carry On Wayward Son","artist":"Kansas"}'),
    ('marvel',        '{"youtubeId":"RpM1Bpx6nC8","title":"Abertura Marvel Studios","artist":"Marvel Studios"}'),
    ('dc',            '{"youtubeId":"Sgtom9QTzKI","title":"Come Together (Liga da Justiça, 2017)","artist":"Gary Clark Jr. & Junkie XL"}'),
    ('star-wars',     '{"youtubeId":"_D0ZQPqeJkk","title":"Star Wars Main Theme","artist":"John Williams"}'),
    ('greys-anatomy', '{"youtubeId":"GKyvMFkuCog","title":"Abertura de Grey''s Anatomy (1ª temporada)","artist":"Grey''s Anatomy"}'),
    ('station-19',    '{"youtubeId":"CZQKiuUuANY","title":"Somewhere Only We Know (Station 19, 7ª temporada)","artist":"Station 19"}'),
    ('bts',           '{"youtubeId":"gdZLi9oWNZg","title":"Dynamite","artist":"BTS"}'),
    ('animes',        '{"youtubeId":"7aMOurgDB-o","title":"Unravel (Tokyo Ghoul)","artist":"TK from Ling Tosite Sigure"}'),
    ('games',         '{"youtubeId":"6VewzN781wQ","title":"Tema de GTA San Andreas","artist":"Rockstar Games"}')
  ) AS v(slug, theme)
  JOIN universes u ON u.slug = v.slug
 WHERE s.universe_id = u.id AND s.official_theme IS NULL;
