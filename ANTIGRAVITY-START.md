# LifeLoop starter

LifeLoop is a personal life-admin assistant concept. Its initial interface is ready; the app will later add AI document extraction, obligation dependencies, prioritization, and evidence-based completion.

## Run locally

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local address shown in the terminal.

## Important files

- `app/lifeloop.tsx` — main LifeLoop interface
- `app/globals.css` — visual design and responsive layout
- `app/page.tsx` — home page entry point
- `app/layout.tsx` — page metadata

## Suggested Antigravity prompt

"Extend this LifeLoop web application into a functional hackathon MVP. Preserve the visual direction. Build a Universal Inbox that accepts pasted text and uploaded PDF/image files. Add a review screen which extracts obligation title, due date, amount, payee, consequence, and source excerpt. Once confirmed, add obligations to a dependency-aware timeline. Include Focus Mode showing the top three actionable tasks, task statuses including Waiting for someone, and proof-of-completion uploads. Store data locally for the prototype. Do not invent financial penalties: show only user-entered or source-backed consequences."
