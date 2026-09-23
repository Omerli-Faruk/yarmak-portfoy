-- name: CreatePortfolioSnapshot :one
INSERT INTO portfolio_snapshots(user_id, total_value, total_cost, profit_loss, recorded_at)
values ($1, $2, $3, $4, $5) RETURNING *;

-- name: GetUserPortfolioHistory :many
SELECT *
FROM portfolio_snapshots
WHERE user_id = $1
ORDER BY recorded_at ASC
    LIMIT 365;

-- name: GetLatestPortfolioSnapshot :one
SELECT *
FROM portfolio_snapshots
where user_id = $1
ORDER BY recorded_at DESC LIMIT 1;

-- name: GetPortfolioPeriodValues :one
WITH user_holdings AS (
    SELECT asset_id, SUM(CASE WHEN type = 'BUY' THEN amount ELSE -amount END) as qty
    FROM transactions
    WHERE user_id = $1 AND deleted_at IS NULL
    GROUP BY asset_id
    HAVING SUM(CASE WHEN type = 'BUY' THEN amount ELSE -amount END) > 0
),
latest_prices AS (
    SELECT uh.asset_id, uh.qty,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id ORDER BY ph.recorded_at DESC LIMIT 1), 0) as p_cur,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at < CURRENT_DATE ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id ORDER BY ph.recorded_at DESC OFFSET 1 LIMIT 1),
            0
        ) as p_1d,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_1w,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '30 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_1m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '90 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_3m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '180 days' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_6m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= date_trunc('year', CURRENT_DATE) ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_ytd,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '1 year' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_1y,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '3 years' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_3y,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= CURRENT_DATE - INTERVAL '5 years' ORDER BY ph.recorded_at ASC LIMIT 1), 0) as p_5y
    FROM user_holdings uh
)
SELECT 
    COALESCE(SUM(qty * CASE WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_cur,
    COALESCE(SUM(qty * CASE WHEN p_1d > 0 THEN p_1d WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_1d,
    COALESCE(SUM(qty * CASE WHEN p_1w > 0 THEN p_1w WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_1w,
    COALESCE(SUM(qty * CASE WHEN p_1m > 0 THEN p_1m WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_1m,
    COALESCE(SUM(qty * CASE WHEN p_3m > 0 THEN p_3m WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_3m,
    COALESCE(SUM(qty * CASE WHEN p_6m > 0 THEN p_6m WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_6m,
    COALESCE(SUM(qty * CASE WHEN p_ytd > 0 THEN p_ytd WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_ytd,
    COALESCE(SUM(qty * CASE WHEN p_1y > 0 THEN p_1y WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_1y,
    COALESCE(SUM(qty * CASE WHEN p_3y > 0 THEN p_3y WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_3y,
    COALESCE(SUM(qty * CASE WHEN p_5y > 0 THEN p_5y WHEN p_cur > 0 THEN p_cur ELSE 0 END), 0)::float as val_5y
FROM latest_prices;


