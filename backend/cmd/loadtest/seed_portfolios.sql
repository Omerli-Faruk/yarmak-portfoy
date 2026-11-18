-- Yük testi için farklı portföylü hesaplar. YALNIZCA veritabanının kopyasında çalıştırın:
--   docker exec yarmak_db createdb -U postgres -T yarmak yarmak_loadtest
--   docker exec -i yarmak_db psql -U postgres -d yarmak_loadtest < cmd/loadtest/seed_portfolios.sql
-- lt001..lt999 hesapları açılır (şifre: yuktesti123). Her hesaba, son 3 yılda 200'den fazla günlük fiyatı olan
-- hisse/fonlardan rastgele 3-8 tanesi, geçmişteki rastgele bir günün fiyatıyla alınmış olarak eklenir.
-- İş bitince: docker exec yarmak_db dropdb -U postgres yarmak_loadtest
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE pool AS
  SELECT a.id FROM assets a
  WHERE a.asset_type IN ('HISSE', 'FON')
    AND (SELECT count(*) FROM price_history p
         WHERE p.asset_id = a.id AND p.recorded_at > now() - interval '3 years') > 200;

INSERT INTO users (email, password_hash, username)
SELECT 'lt' || lpad(g::text, 3, '0') || '@yuk.test', h.hash, 'lt' || lpad(g::text, 3, '0')
FROM generate_series(1, 999) g, (SELECT crypt('yuktesti123', gen_salt('bf', 10)) AS hash) h;

-- "+ u.id * 0" alt sorguyu dış satıra bağlar; yoksa Postgres onu bir kez çalıştırıp herkese aynı portföyü verir.
INSERT INTO transactions (user_id, asset_id, type, amount, price, transaction_date)
SELECT u.id, p.id, 'BUY', (1 + floor(random() * 100))::numeric, ph.price, ph.recorded_at
FROM users u
CROSS JOIN LATERAL (SELECT id FROM pool ORDER BY random() + u.id * 0 LIMIT (3 + floor(random() * 6))::int) p
CROSS JOIN LATERAL (SELECT price, recorded_at FROM price_history
                    WHERE asset_id = p.id AND recorded_at > now() - interval '3 years'
                    ORDER BY random() + u.id * 0 LIMIT 1) ph
WHERE u.username LIKE 'lt___' AND u.email LIKE '%@yuk.test';

SELECT count(DISTINCT t.user_id) AS hesap, count(*) AS islem, count(DISTINCT t.asset_id) AS farkli_varlik
FROM transactions t JOIN users u ON u.id = t.user_id
WHERE u.email LIKE '%@yuk.test';
