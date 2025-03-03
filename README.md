# Trading Fours

A collaborative music application where users can interact with a virtual piano and create music together.

## Development

To start your server:

* Run `mix setup` to install and setup dependencies
* Start Phoenix endpoint with `mix phx.server` or inside IEx with `iex -S mix phx.server`

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser.

## Frontend Development

* Run `cd assets && npm run dev` to start the Vite development server

## Deployment

* Build assets with `mix assets.build`
* Deploy assets with `mix assets.deploy`
* Database setup: `mix ecto.setup`
* Database reset: `mix ecto.reset`