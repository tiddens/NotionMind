# NotionMind

Mindmapping tool that writes Markdown files for easy import into Notion.

Use Node.js 22.12+ (Node.js 24 is supported). Install and run the complete app:

```sh
npm ci
npm run build
npm run server
```

Open http://127.0.0.1:3001. Press Ctrl+C to stop the server.
On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is disabled.

For development, run `npm run dev` and open http://localhost:5173. This starts
both the frontend and API. `npm run preview` only previews the frontend build.

Click an image to open the full-window viewer. Use the mouse wheel, pinch, or
zoom buttons to zoom, and drag to move around. **Fit** resets the view,
**Full screen** hides the browser chrome, and Escape closes the viewer.
Preview cards follow each image's proportions to avoid empty space around wide images.

Hold Ctrl (or Command on macOS) and scroll over the canvas to zoom toward the
pointer. Use the bottom-right +/− controls to zoom, or click the percentage to
reset to 100% and center the map. Scrolling without Ctrl pans the map.

Maps are saved in `maps/` by default. Set `NOTIONMIND_DIR` to use another folder
and `PORT` to change the API port. The API binds to `127.0.0.1` for local use.
Browser requests must come from the local frontend or an explicitly configured
`CORS_ORIGIN`. Paths through symbolic links or directory junctions are rejected,
and image uploads are limited to 10 MB.

Validation:

```sh
npm audit
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests use a temporary copy of the sample map and leave your maps alone.
