# TradingFours Development Guide

## Build Commands
- Setup project: `mix setup`
- Start Phoenix server: `mix phx.server` or `iex -S mix phx.server` (interactive)
- Run all tests: `mix test`
- Run single test: `mix test path/to/test_file.exs:line_number`
- Frontend development: `cd assets && npm run dev`
- Build assets: `mix assets.build`
- Deploy assets: `mix assets.deploy`
- Database setup: `mix ecto.setup`
- Database reset: `mix ecto.reset`

## Code Style Guidelines

### Elixir/Phoenix
- Format code with `mix format`
- Follow Phoenix naming conventions (context modules, schemas, controllers)
- Use pipe operators (`|>`) for data transformations
- Handle errors with pattern matching and `{:ok, result}` / `{:error, reason}` tuples
- Required fields validation via `validate_required/2` in schema changesets

### JavaScript/React
- TypeScript with strict mode enabled
- Function components with hooks (useState, useEffect, useRef, useCallback)
- PascalCase for component names, camelCase for functions/hooks
- Custom hooks prefixed with "use" (e.g., usePiano)
- Event handlers prefixed with "handle" (e.g., handleNoteOn)
- 2-space indentation (no tabs) per .prettierrc
- TailwindCSS for styling
- Proper error handling with try/catch and fallbacks

## Feature Locations
- The keyboard is in `./assets/react-components/piano.jsx` and `./assets/react-components/hooks/usePiano.js`
- The piano roll is in `./assets/react-components/player.jsx`
