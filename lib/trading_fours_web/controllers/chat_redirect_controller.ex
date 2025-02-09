defmodule TradingFoursWeb.ChatRedirectController do
  use TradingFoursWeb, :controller

  def redirect_to_room(conn, _params) do
    redirect(conn, to: ~p"/chat/#{Ecto.UUID.generate()}")
  end
end
