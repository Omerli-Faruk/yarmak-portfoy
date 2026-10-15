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
WITH current_price AS (
    SELECT ph.price, ph.recorded_at FROM price_history ph WHERE ph.asset_id = $1 ORDER BY ph.recorded_at DESC LIMIT 1
),
price_1d AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at < date_trunc('day', (SELECT cp.recorded_at FROM current_price cp)) ORDER BY ph.recorded_at DESC LIMIT 1
),
price_1w AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1
),
price_1m AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '1 month' ORDER BY ph.recorded_at ASC LIMIT 1
),
price_3m AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '3 months' ORDER BY ph.recorded_at ASC LIMIT 1
),
price_6m AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '6 months' ORDER BY ph.recorded_at ASC LIMIT 1
),
price_ytd AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= date_trunc('year', (SELECT cp.recorded_at FROM current_price cp)) ORDER BY ph.recorded_at ASC LIMIT 1
),
price_1y AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '1 year' ORDER BY ph.recorded_at ASC LIMIT 1
),
price_5y AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 ORDER BY ph.recorded_at ASC LIMIT 1
)
SELECT 
    COALESCE((SELECT cp.price FROM current_price cp), '0')::text as current_p,
    COALESCE((SELECT p.price FROM price_1d p), '0')::text as p_1d,
    COALESCE((SELECT p.price FROM price_1w p), '0')::text as p_1w,
    COALESCE((SELECT p.price FROM price_1m p), '0')::text as p_1m,
    COALESCE((SELECT p.price FROM price_3m p), '0')::text as p_3m,
    COALESCE((SELECT p.price FROM price_6m p), '0')::text as p_6m,
    COALESCE((SELECT p.price FROM price_ytd p), '0')::text as p_ytd,
    COALESCE((SELECT p.price FROM price_1y p), '0')::text as p_1y,
    COALESCE((SELECT p.price FROM price_5y p), '0')::text as p_all;

-- name: GetAssetPrice3Y :one
WITH current_price AS (
    SELECT ph.price, ph.recorded_at FROM price_history ph WHERE ph.asset_id = $1 ORDER BY ph.recorded_at DESC LIMIT 1
),
price_3y AS (
    SELECT ph.price FROM price_history ph WHERE ph.asset_id = $1 AND ph.recorded_at >= (SELECT cp.recorded_at FROM current_price cp) - INTERVAL '3 years' ORDER BY ph.recorded_at ASC LIMIT 1
)
SELECT COALESCE((SELECT p.price FROM price_3y p), '0')::text;

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

