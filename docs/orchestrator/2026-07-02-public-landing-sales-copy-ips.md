# Public landing sales copy IPS note

Vision -> customers can understand that Alfares marketplace services let them sell discounted Alfares/company supplier products, their own products, and available products from other users or the shared catalog.
Goal Impact -> public landing copy states the sales model and the automation/customer responsibility split before users enter the dashboard.
System -> allegro public frontend landing page.
Feature -> marketplace sales-source and automation copy for Allegro.
Task -> update landing copy only; avoid deploy.
Execution Plan -> inspect dirty worktree, edit the landing page copy, validate syntax/build surface without touching unrelated files.
Coding Prompt -> remote worker prompt dated 2026-07-02 for allegro/aukro/bazos landing sales copy.
Code -> services/frontend/src/pages/LandingPage.tsx.
Validation -> git diff --check passed; npm --prefix services/frontend run build passed with Vite CJS, baseline-browser-mapping, and browserslist staleness warnings.
