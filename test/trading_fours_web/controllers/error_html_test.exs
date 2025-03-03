defmodule TradingFoursWeb.ErrorHTMLTest do
  use TradingFoursWeb.ConnCase, async: true

  # Bring render_to_string/4 for testing custom views
  import Phoenix.Template

  test "renders 404.html" do
    result = render_to_string(TradingFoursWeb.ErrorHTML, "404", "html", [])
    assert result =~ "Page Not Found"
    assert result =~ "Trading Fours Logo"
  end

  test "renders 500.html" do
    result = render_to_string(TradingFoursWeb.ErrorHTML, "500", "html", [])
    assert result =~ "Server Error"
    assert result =~ "Trading Fours Logo"
  end
end
