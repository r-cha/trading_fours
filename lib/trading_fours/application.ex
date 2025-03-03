defmodule TradingFours.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      TradingFoursWeb.Telemetry,
      TradingFours.Repo,
      {DNSCluster, query: Application.get_env(:trading_fours, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: TradingFours.PubSub},
      TradingFoursWeb.Presence,
      # Start the Finch HTTP client for sending emails
      {Finch, name: TradingFours.Finch},
      # Start a worker by calling: TradingFours.Worker.start_link(arg)
      # {TradingFours.Worker, arg},
      # Start to serve requests, typically the last entry
      TradingFoursWeb.Endpoint,
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: TradingFours.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    TradingFoursWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
