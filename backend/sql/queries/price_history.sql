-- name: CreatePriceHistory :one
INSERT INTO price_history (asset_id, price, recorded_at)
VALUES ($1, $2, $3)
    RETURNING *;

-- name: GetAssetPriceHistory :many
SELECT * FROM price_history
WHERE asset_id = $1
ORDER BY recorded_at DESC
    LIMIT 5000;

-- name: UpsertPriceHistory :exec
INSERT INTO price_history (asset_id, price, recorded_at)
VALUES ($1, $2, $3)
ON CONFLICT (asset_id, (timezone('UTC', recorded_at)::date)) DO UPDATE
SET price = EXCLUDED.price;

-- name: GetAssetPriceHistoryRange :many
SELECT id, asset_id, price, recorded_at 
FROM price_history
WHERE asset_id = $1 AND recorded_at >= $2
ORDER BY recorded_at ASC;
-- name: GetAssetPriceHistoryWeekly :many
SELECT DISTINCT ON (date_trunc('week', recorded_at))
    id, asset_id, price, recorded_at
FROM price_history
WHERE asset_id = $1 AND recorded_at >= $2
ORDER BY date_trunc('week', recorded_at) ASC, recorded_at DESC;

-- name: GetAssetPriceHistoryMonthly :many
SELECT DISTINCT ON (date_trunc('month', recorded_at))
    id, asset_id, price, recorded_at
FROM price_history
WHERE asset_id = $1 AND recorded_at >= $2
ORDER BY date_trunc('month', recorded_at) ASC, recorded_at DESC;

-- name: GetAssetReturnsSummary :one
-- Varlığın en son fiyatı ve dönem başlarındaki fiyatı. Dönem başı = kesim gününün sonundaki ya da öncesindeki son kayıt
-- (YBB, 1Y, 3Y, 5Y'de yoksa kesimden sonraki 7 gün içindeki ilk kayıt); geçmiş o kadar eskiye uzanmıyorsa 0
-- (= veri yok). Eskiden kesimden sonraki ilk kayıt alınıyordu, kısa geçmişte dönem etiketi yanlıştı (#10).
-- p_all varlığın bilinen ilk fiyatı ("Tümü").
WITH current_price AS (
    SELECT ph.price, ph.recorded_at FROM price_history ph WHERE ph.asset_id = $1 ORDER BY ph.recorded_at DESC LIMIT 1
)
SELECT
        COALESCE((SELECT cp.price::float FROM current_price cp), 0)::float AS current_p,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at < date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_1d,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '7 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_1w,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '30 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_1m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '90 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_3m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '180 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_6m,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at < date_trunc('year', (SELECT cp.recorded_at FROM current_price cp)) ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= date_trunc('year', (SELECT cp.recorded_at FROM current_price cp)) AND ph.recorded_at <= date_trunc('year', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_ytd,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '1 year') ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at > (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '1 year') AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '1 year') + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_1y,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '3 years') ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at > (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '3 years') AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '3 years') + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_3y,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '5 years') ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at > (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '5 years') AND ph.recorded_at <= (date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) + INTERVAL '1 day' - INTERVAL '5 years') + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_5y,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = $1 ORDER BY ph.recorded_at ASC LIMIT 1), 0)::float AS p_all;

-- name: GetAssetDailyChangesAll :many
SELECT 
    a.id,
    p1.price as latest_p,
    p2.price as prev_p
FROM assets a
JOIN LATERAL (
    SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1
) p1 ON true
JOIN LATERAL (
    SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC OFFSET 1 LIMIT 1
) p2 ON true
WHERE p2.price > 0;

-- name: GetAssetDailyChangesByIDs :many
SELECT 
    a.id,
    p1.price as latest_p,
    p2.price as prev_p
FROM assets a
JOIN LATERAL (
    SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC LIMIT 1
) p1 ON true
JOIN LATERAL (
    SELECT price FROM price_history WHERE asset_id = a.id ORDER BY recorded_at DESC OFFSET 1 LIMIT 1
) p2 ON true
-- İki fiyat kaydı olmayan varlıklar atlanır; LEFT JOIN'de NULL dönen prev_p tüm isteği 500'e düşürüyordu
WHERE a.id = ANY($1::bigint[]) AND p2.price > 0;

