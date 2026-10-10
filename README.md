# LionPlate official menu updater

A small scheduled job downloads the eleven official Columbia Dining pages, parses their dated menus and hours, and publishes a JSON feed. It runs independently of ChatGPT and your phone. No meal plans, ratings, saved ingredient notes, login cookies, or Sites service tokens belong in this repository.

## Connect it

1. Create a public GitHub repository named `lionplate-menus`. Upload the CONTENTS of this folder to its default branch. Include `.github/workflows/refresh-menus.yml`.
2. In its Actions tab, select **Refresh official Columbia menus** and **Run workflow**. Enable Actions if GitHub asks.
3. Check that the run succeeds and `data/menus.json` has fresh per-source `updatedAt` values. The initial JSON is a saved starter copy, not proof that the scheduled job ran.
4. Give the repository URL to Codex. Codex will configure the LionPlate runtime variable `LIONPLATE_MENU_FEED_URL` to the repository's raw `data/menus.json` URL, deploy the change, and verify that the site can download and persist it.
5. After the actual GitHub run and site readback succeed, turn off the old ChatGPT updater.

Only the official menu feed is public. Your existing private LionPlate site and personal records keep their current access controls.

## Timing and failures

The workflow requests a run at minute 17 of every hour in UTC. GitHub can delay scheduled jobs, so this is not an exact clock guarantee. Each successful run updates the feed, which LionPlate imports when the website or widget requests data. The app does not need to be open for the widget to request its saved plan. Apple decides when to activate the widget.

Each source has its own last-success timestamp. An HTTP error or a changed page format keeps that source's previous menus, records its error, publishes successful sources, and marks the run failed for visibility. The next scheduled run retries. An unavailable JSON feed leaves the site's existing D1 menus intact.

GitHub gives this workflow a job-specific `GITHUB_TOKEN` with repository contents permission. No ChatGPT permission or manually stored access token is required. Repository rules that prohibit workflow pushes must allow this updater before activation. Scheduled workflows in public repositories can be disabled after 60 days with no repository activity; successful hourly data commits provide activity. Check Actions if updates stop.

## Run locally

Use Node.js 24 or newer and curl:

```sh
node refresh.mjs
```

`menu-source.ts` is the same parser used by LionPlate. When parser changes are needed, update this repository and the site together. The eleven official source URLs are fixed in that file. Weekly rotations are read from published dates rather than inferred.
