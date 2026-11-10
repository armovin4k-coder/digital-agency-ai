# Digital Agency AI project guidance

## Architecture

- The Flask application in `app.py` renders the Russian and English source pages in `templates/`.
- `services.py` and `services_en.py` are the source catalogs for service pages.
- `static/` contains public assets. Keep optimized project images and provide descriptive `alt` text.
- `php/` contains the PHP front controller and hosting configuration templates.
- `build_php.py` creates the PHP hosting package from the running Flask application. It must not overwrite an existing output package.
- `php_site/` and its ZIP are generated deployment artifacts; never place secrets in them or publish them without explicit approval.

## Content and portfolio

- Keep the eight core service directions distinct: website development, Telegram development, web applications/CRM, AI/automation, design, SEO, SMM, and advertising.
- SEO, SMM, and paid advertising are separate services. Never promise rankings, audience growth, enquiries, sales, or other guaranteed marketing outcomes.
- Classify portfolio items as implemented projects, the agency's own products, or demo concepts. Never present an unverified concept as client work or as implemented functionality.
- Only describe project features, technologies, outcomes, and public links that are supported by owner-provided information or direct verification.
- Mark missing screenshots, unverified status, and unavailable features accurately. Do not invent clients, testimonials, results, awards, prices, or team credentials.
- Keep project detail metadata unique and include self-referencing canonical URLs. Add new public routes to Flask, the PHP route map, the PHP builder, and both sitemap implementations.
- Use the unified contact form and only publish contact details confirmed for public use. Do not publish either disputed WhatsApp number until the owner verifies it.
- Do not imply a physical Krasnoyarsk office or publish an address unless its public status is confirmed.

## Implementation and validation

- Preserve the existing Flask/PHP architecture and working routes; avoid new runtime dependencies for simple page features.
- Keep Russian and English content consistent in classification and avoid unsupported translations or claims.
- Preserve keyboard access, responsive layouts, reduced-motion support, secure external-link attributes, and existing form consent behavior.
- Run the smallest relevant checks after changes, including Python syntax/tests, PHP lint for PHP changes, rendered route checks, sitemap checks, and `git diff --check`.
- Never publish, upload, or overwrite generated hosting files without explicit approval. Do not read or expose secret configuration values.
