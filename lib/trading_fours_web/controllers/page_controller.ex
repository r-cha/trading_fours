defmodule TradingFoursWeb.PageController do
  use TradingFoursWeb, :controller

  def home(conn, _params) do
    # The home page is often custom made,
    # so skip the default app layout.
    render(conn, :home, layout: false)
  end
  
  def social_card(conn, _params) do
    # Render the social card template for screenshot capture
    render(conn, :social_card, layout: false)
  end
end
