# Trading Fours

A collaborative music application where strangers can connect to create music together. Users are randomly matched with another musician and can collaborate by trading musical phrases through a virtual piano interface.

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

## Social Card Image

The app includes meta tags for social media sharing. To generate the social card image:

1. Start the development server with `mix phx.server`
2. Visit [`localhost:4000/social-card`](http://localhost:4000/social-card) in your browser
3. Take a screenshot at 1200x630 dimensions (standard Open Graph image size)
4. Save the screenshot as `tradingfours-social.png` in the `/priv/static/images/` directory
5. Run `mix assets.deploy` to include it in the build