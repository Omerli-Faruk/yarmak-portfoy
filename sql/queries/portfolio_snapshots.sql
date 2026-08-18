-- name: CreatePortfolioSnapshot :one
INSERT INTO portfolio_snapshots(user_id, total_value, total_cost, profit_loss, recorded_at)
values ($1, $2, $3, $4, $5) RETURNING *;

-- name: GetUserPortfolioHistory :many
SELECT *
from portfolio_snapshots
where user_id = $1
ORDER BY recorded_at ASC;

-- name: GetLatestPortfolioSnapshot :one
SELECT *
FROM portfolio_snapshots
where user_id = $1
ORDER BY recorded_at DESC LIMIT 1;