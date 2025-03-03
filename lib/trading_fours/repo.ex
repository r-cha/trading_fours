defmodule TradingFours.Repo do
  use Ecto.Repo,
    otp_app: :trading_fours,
    adapter: Ecto.Adapters.Postgres
end
