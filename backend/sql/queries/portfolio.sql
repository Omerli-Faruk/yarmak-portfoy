-- name: GetPortfolioPeriodPrices :many
-- Elde tutulan her varlık için bugünkü fiyat ve dönem başlarındaki (1G, 1H, 1A ... 5Y) fiyat. Dönem başı fiyatı,
-- kesim gününün sonundaki ya da öncesindeki son kayıttır; geçmiş o tarihe uzanmıyorsa 0 (= veri yok). Eskiden kesimden
-- SONRAKİ ilk kayıt alınıyordu: 1 yıllık geçmişi olan varlıkta "5Y getirisi" aslında 1 yıllık getiriydi (#10).
-- YBB, 1Y, 3Y ve 5Y'de kesimden sonraki 7 gün içindeki ilk kayıt da kabul edilir: 5 yıllık geçmiş tam 5 yıl önce
-- tatile denk gelen bir günde başlıyorsa 5Y kaybolmasın. Dönem getirisi Go'da, o dönemde fiyatı olan varlıklarla hesaplanır.
WITH user_holdings AS (
    SELECT asset_id, SUM(CASE WHEN type = 'BUY' THEN amount ELSE -amount END) as qty
    FROM transactions
    WHERE user_id = $1 AND deleted_at IS NULL
    GROUP BY asset_id
    HAVING SUM(CASE WHEN type = 'BUY' THEN amount ELSE -amount END) > 0
)
SELECT uh.asset_id,
        uh.qty::float AS qty,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_cur,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at < CURRENT_DATE ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id ORDER BY ph.recorded_at DESC OFFSET 1 LIMIT 1),
            0)::float AS p_1d,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '7 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_1w,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '30 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_1m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '90 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_3m,
        COALESCE((SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '180 days') ORDER BY ph.recorded_at DESC LIMIT 1), 0)::float AS p_6m,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at < date_trunc('year', CURRENT_DATE) ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at >= date_trunc('year', CURRENT_DATE) AND ph.recorded_at <= date_trunc('year', CURRENT_DATE) + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_ytd,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '1 year') ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at > (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '1 year') AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '1 year') + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_1y,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '3 years') ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at > (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '3 years') AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '3 years') + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_3y,
        COALESCE(
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '5 years') ORDER BY ph.recorded_at DESC LIMIT 1),
            (SELECT price::float FROM price_history ph WHERE ph.asset_id = uh.asset_id AND ph.recorded_at > (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '5 years') AND ph.recorded_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '5 years') + INTERVAL '7 days' ORDER BY ph.recorded_at ASC LIMIT 1),
            0)::float AS p_5y
FROM user_holdings uh
ORDER BY uh.asset_id;
