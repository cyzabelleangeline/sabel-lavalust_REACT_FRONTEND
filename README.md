# Lava / Stock — React client

React and Vite inventory UI for the LavaLust product API. The client sends all product and authentication requests to the API; it does not connect to MySQL.

## Run locally

1. Start the API from the LavaLust repository after configuring `.env` and running `php lava migration run`:

   ```sh
   php lava serve --port=3000
   ```

2. In this repository, copy `.env.example` to `.env` and leave `VITE_API_URL` blank. Install dependencies and run Vite:

   ```sh
   npm install
   npm run dev
   ```

   The Vite development proxy forwards `/api` requests to `http://127.0.0.1:3000`.

Create an account from the login page, then add, edit, search and remove products from the catalog.

## Deploy as a static site

Build command: `npm run build`

Publish directory: `dist`

Set `VITE_API_URL` to the deployed LavaLust API origin before the build. Set the API's `allow_origin` to the exact deployed frontend origin in `app/config/api.php`. Configure Render database and token secrets in the API service environment, never in this repository.

The submitted repository links and deployed URLs should be added to the assignment form after pushing the repositories and publishing both services. Capture the required login, catalog, create, edit, delete, and Aiven database screenshots from the running application.
