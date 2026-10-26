import shutil
import zipfile
from pathlib import Path


PROJECT_NAME = "ai_agency_project"
PROJECT_FILES = (
    "app.py",
    "build_php.py",
    "php/index.php",
    "php/config.example.php",
    "php/config.preview.php",
    "php/.htaccess",
    "php/pages/.htaccess",
    "services.py",
    "services_en.py",
    "requirements.txt",
    "Dockerfile",
    "docker-compose.yml",
    ".dockerignore",
    ".env.example",
    ".gitignore",
    "README.md",
    "seo_core_ru.csv",
    "templates/index.html",
    "templates/service.html",
    "templates/index_en.html",
    "templates/service_en.html",
    "templates/privacy.html",
    "templates/privacy_en.html",
    "templates/cookie_banner.html",
    "static/circuit.svg",
    "static/theme.css",
    "static/cases/auto-prime.png",
    "static/cases/celsior.jpeg",
    "static/cases/flowers-miniapp.png",
    "static/cases/nail-studio.jpeg",
    "static/cases/pknvr.jpeg",
    "static/cases/auto-prime-optimized.jpg",
    "static/cases/celsior-optimized.jpg",
    "static/cases/flowers-miniapp-optimized.jpg",
    "static/cases/nail-studio-optimized.jpg",
    "static/cases/pknvr-optimized.jpg",
)


def create_project():
    source = Path(__file__).resolve().parent
    project = source / PROJECT_NAME
    archive = source / f"{PROJECT_NAME}.zip"

    if project.exists() or archive.exists():
        raise FileExistsError(
            f"Refusing to overwrite existing output: {project} or {archive}"
        )

    for relative_path in PROJECT_FILES:
        source_file = source / relative_path
        if not source_file.is_file():
            raise FileNotFoundError(f"Required project file not found: {source_file}")

    project.mkdir()
    try:
        for relative_path in PROJECT_FILES:
            source_file = source / relative_path
            destination = project / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file, destination)

        with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as zip_file:
            for file_path in project.rglob("*"):
                if file_path.is_file():
                    zip_file.write(file_path, file_path.relative_to(project))
    except Exception:
        shutil.rmtree(project)
        raise

    print(f"Project created: {project}")
    print(f"Archive created: {archive}")


if __name__ == "__main__":
    create_project()
