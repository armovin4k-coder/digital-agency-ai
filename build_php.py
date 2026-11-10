import ast
import os
import re
import shutil
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse


PROJECT_NAME = "php_site"
SOURCE_SITE_URL = os.environ.get("SOURCE_SITE_URL", "http://localhost:8080").rstrip("/")
PHP_SOURCE_FILES = (
    "php/index.php",
    "php/config.example.php",
    "php/config.preview.php",
    "php/.htaccess",
    "php/pages/.htaccess",
)


def get_service_slugs(project_root):
    source = (project_root / "services.py").read_text(encoding="utf-8")
    module = ast.parse(source)
    for statement in module.body:
        if isinstance(statement, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "SERVICE_CATALOG"
            for target in statement.targets
        ):
            catalog = ast.literal_eval(statement.value)
            return [service["slug"] for service in catalog]
    raise ValueError("SERVICE_CATALOG was not found in services.py")


def get_pages(service_slugs):
    pages = {
        "/": "index.html",
        "/en": "en.html",
        "/privacy": "privacy.html",
        "/en/privacy": "en_privacy.html",
        "/projects/splav-po-mane": "project_splav_po_mane.html",
        "/projects/cvety-ryadom": "project_cvety_ryadom.html",
        "/projects/lusolink": "project_lusolink.html",
        "/projects/digital-agency-ai": "project_digital_agency_ai.html",
        "/industries/": "industries.html",
        "/industries/beauty/": "industry_beauty.html",
        "/industries/medical/": "industry_medical.html",
        "/industries/construction/": "industry_construction.html",
        "/industries/tourism/": "industry_tourism.html",
    }
    for slug in service_slugs:
        pages[f"/services/{slug}"] = f"service_{slug}.html"
        pages[f"/en/services/{slug}"] = f"en_service_{slug}.html"
    return pages


def fetch_page(path):
    request = urllib.request.Request(
        SOURCE_SITE_URL + path,
        headers={"User-Agent": "DigitalAgencyPHPBuilder/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(
                    f"Source page {path} returned HTTP {response.status}"
                )
            return response.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(
            f"Could not fetch {SOURCE_SITE_URL + path}. "
            "Start the current site with `docker compose up -d` before building."
        ) from exc


def validate_rendered_page(path, html):
    if re.search(r"\{\{|\{%|url_for\(", html):
        raise ValueError(f"Unrendered template syntax found in generated page {path}")
    if '<html lang="en">' not in html and path.startswith("/en"):
        raise ValueError(f"Expected English page language metadata for {path}")


def copy_static_assets(project_root, output_root):
    source = project_root / "static"
    destination = output_root / "static"
    if not source.is_dir():
        raise FileNotFoundError(f"Static asset directory not found: {source}")
    shutil.copytree(source, destination)


def create_project():
    project_root = Path(__file__).resolve().parent
    output_root = project_root / PROJECT_NAME
    archive_path = project_root / f"{PROJECT_NAME}.zip"
    if output_root.exists() or archive_path.exists():
        raise FileExistsError(
            f"Refusing to overwrite existing output: {output_root} or {archive_path}"
        )

    for relative_path in PHP_SOURCE_FILES:
        if not (project_root / relative_path).is_file():
            raise FileNotFoundError(f"Required PHP file not found: {relative_path}")

    source_origin = urlparse(SOURCE_SITE_URL)
    if source_origin.scheme not in {"http", "https"} or not source_origin.netloc:
        raise ValueError("SOURCE_SITE_URL must be an http(s) URL")
    source_origin = f"{source_origin.scheme}://{source_origin.netloc}"

    output_root.mkdir()
    try:
        pages_directory = output_root / "pages"
        pages_directory.mkdir()
        for route, filename in get_pages(get_service_slugs(project_root)).items():
            html = fetch_page(route)
            validate_rendered_page(route, html)
            html = html.replace(source_origin, "__SITE_ORIGIN__")
            (pages_directory / filename).write_text(html, encoding="utf-8")

        copy_static_assets(project_root, output_root)
        for relative_path in PHP_SOURCE_FILES:
            if relative_path == "php/config.preview.php":
                destination = output_root / "config.php"
            else:
                destination = output_root / Path(relative_path).relative_to("php")
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(project_root / relative_path, destination)

        with zipfile.ZipFile(archive_path, "x", zipfile.ZIP_DEFLATED) as archive:
            for file_path in output_root.rglob("*"):
                if file_path.is_file():
                    archive.write(file_path, file_path.relative_to(output_root))
    except Exception:
        shutil.rmtree(output_root)
        if archive_path.exists():
            archive_path.unlink()
        raise

    print(f"PHP site created: {output_root}")
    print(f"Deployment archive created: {archive_path}")
    print(f"Rendered pages: {len(get_pages(get_service_slugs(project_root)))}")


if __name__ == "__main__":
    create_project()
