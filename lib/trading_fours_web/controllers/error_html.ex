defmodule TradingFoursWeb.ErrorHTML do
  @moduledoc """
  This module is invoked by your endpoint in case of errors on HTML requests.
  """
  use TradingFoursWeb, :html

  # Custom error pages
  embed_templates "error_html/*"
end
