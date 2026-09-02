# AWS SAA Field Notes

A Markdown-first lecture site for AWS Certified Solutions Architect – Associate study notes. The visual language is inspired by the editorial, terminal-driven presentation of [Logging Sucks](https://loggingsucks.com/), adapted into a searchable multi-post curriculum.

## What is included

- Astro static site with no database or CMS
- Validated Markdown lecture collection
- Landing page, searchable lecture library, and generated lecture routes
- SAA-C03 domain metadata and official exam weightings
- Table of contents, syntax highlighting, code copy, reading progress, and previous/next navigation
- Browser-local completion tracking
- RSS feed, sitemap, social metadata, responsive layouts, and reduced-motion support

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4321`. Before publishing, run:

```bash
pnpm build
pnpm preview
```

## Publish a lecture

1. Copy [`templates/lecture.md`](templates/lecture.md) into `src/content/lectures/`.
2. Rename it with a stable, URL-friendly filename, such as `07-decoupling-with-sqs.md`.
3. Fill in the frontmatter and write the lesson in ordinary Markdown.
4. Set `draft: false`, commit, and deploy. The route is generated from the filename: `/lectures/07-decoupling-with-sqs/`.

Required frontmatter:

```yaml
---
title: "Decouple the work, not the outcome."
description: "Use queues and events to absorb demand without losing control of failure."
order: 7
domain: "resilient"
publishedAt: 2026-09-02
difficulty: "Associate"
tags: ["sqs", "sns", "eventbridge"]
objectives:
  - "Choose between queues, pub/sub, and event buses"
  - "Set visibility timeouts and dead-letter policies"
featured: false
draft: false
---
```

`domain` must be one of `secure`, `resilient`, `performance`, or `cost`. `difficulty` must be `Foundation`, `Associate`, or `Deep dive`. The build fails with a useful message if frontmatter does not match the schema in [`src/content.config.ts`](src/content.config.ts).

Normal Markdown features—headings, links, lists, tables, blockquotes, fenced code, and HTML `<details>` quizzes—are styled automatically. Level-two and level-three headings populate the on-page table of contents.

## Project map

```text
src/
├── components/           # Header, footer, terminal, lecture cards
├── content/lectures/     # Publish Markdown here
├── layouts/              # Shared document shell and metadata
├── lib/lectures.ts       # Domain map, sorting, URL/date helpers
├── pages/                # Home, library, post routes, RSS, 404
├── content.config.ts     # Frontmatter validation
└── styles/global.css     # Site-wide visual system
```

## Deploy

The generated site is in `dist/` and works on any static host. Set `SITE_URL` to the production origin when building so canonical URLs, RSS, and the sitemap point to the correct domain:

```bash
SITE_URL=https://notes.example.com pnpm build
```

### GitHub Pages

The workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) validates, builds, and publishes the site whenever `main` is updated. It configures Astro for this project URL:

```text
https://zer0f8th.github.io/AWS-SAA-Study/
```

One-time repository setup:

1. Open **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy to GitHub Pages** manually from the Actions tab.

The workflow sets `SITE_URL` and `BASE_PATH` so links and assets work beneath `/AWS-SAA-Study`. Local development still runs at the root URL. For a custom domain, change `SITE_URL` to that origin, set `BASE_PATH: /`, and configure the domain in the repository's Pages settings.

This is an independent study project and is not affiliated with or endorsed by Amazon Web Services.
