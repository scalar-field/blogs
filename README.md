# blogs

The Scalar Field blog — research notes and strategy write-ups, built on [Mintlify](https://mintlify.com).

## Local development

```bash
npm install -g mint
mint dev
```

Open the printed local URL to preview. Run `mint broken-links` to validate links.

## Structure

- `docs.json` — site config (theme, branding, navigation)
- `index.mdx` — blog landing page
- `strategies/` — strategy write-ups
- `logo/`, `favicon.svg` — Scalar Field branding
- `scripts/update_nav.py` — inserts a published page into the matching `docs.json` nav group
- `.github/workflows/publish-doc.yml` — publishes a post via GitHub `repository_dispatch`

## Publishing a post via API

The `publish-doc` workflow listens for a `repository_dispatch` event and downloads a
public markdown URL into the repo, updates navigation, validates, and commits to `main`
(which Mintlify auto-deploys). It expects a `client_payload` with `file_url`,
`target_path`, and `nav_group` (e.g. `"Strategies"`).
