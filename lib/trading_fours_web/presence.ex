defmodule TradingFoursWeb.Presence do
  use Phoenix.Presence, 
    otp_app: :trading_fours,
    pubsub_server: TradingFours.PubSub,
    presence: __MODULE__
end
