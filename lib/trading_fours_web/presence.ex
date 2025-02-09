defmodule TradingFoursWeb.Presence do
  use Phoenix.Presence,
    otp_app: :trading_fours,
    pubsub_server: TradingFours.PubSub
end
