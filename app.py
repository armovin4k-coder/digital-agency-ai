import os
import secrets
from urllib.parse import urlparse

import requests
from flask import Flask, abort, current_app, g, jsonify, make_response, render_template, request
from markupsafe import escape

from services import SERVICES_BY_SLUG, SERVICE_CATALOG
from services_en import SERVICES_EN_BY_SLUG, SERVICE_CATALOG_EN

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
app.config["TRUSTED_HOSTS"] = [
    host.strip()
    for host in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "").strip().rstrip("/")
if PUBLIC_SITE_URL:
    parsed_site_url = urlparse(PUBLIC_SITE_URL)
    if (
        parsed_site_url.scheme not in {"http", "https"}
        or not parsed_site_url.netloc
        or parsed_site_url.username
        or parsed_site_url.password
        or parsed_site_url.path
        or parsed_site_url.query
        or parsed_site_url.fragment
    ):
        raise ValueError("PUBLIC_SITE_URL must be an http(s) origin without a path")

RELATED_SERVICE_SLUGS = {
    "seo": ("website-development", "contextual-advertising", "business-promotion"),
    "website-development": ("seo", "digital-products", "website-support"),
    "contextual-advertising": ("business-promotion", "seo", "smm"),
    "website-support": ("website-development", "digital-products", "process-automation"),
    "smm": ("business-promotion", "contextual-advertising", "seo"),
    "business-promotion": ("seo", "contextual-advertising", "smm"),
    "process-automation": ("chatbots", "telegram-mini-app", "digital-products"),
    "telegram-mini-app": ("chatbots", "digital-products", "process-automation"),
    "digital-products": ("website-development", "process-automation", "website-support"),
    "chatbots": ("telegram-mini-app", "process-automation", "digital-products"),
}

SERVICE_FAQS = {
    "seo": (
        ("С чего начинается SEO-продвижение?", "С проверки технического состояния сайта, индексации и структуры спроса. После этого согласуем приоритеты и план работ."),
        ("Можно ли рассчитывать на быстрый выход в топ?", "Нет универсального срока или гарантии позиций: результат зависит от конкуренции, состояния сайта, спроса и регулярности работ."),
    ),
    "website-development": (
        ("Что подготовить для разработки сайта?", "Полезно описать цели сайта, аудиторию, услуги и желаемое действие посетителя. Если материалов пока нет, состав работ можно обсудить отдельно."),
        ("Сможете ли вы помочь после запуска?", "Да, техническая поддержка и дальнейшие улучшения могут быть отдельным этапом по согласованному объёму."),
    ),
    "contextual-advertising": (
        ("Что нужно до запуска рекламы?", "Нужно согласовать целевое действие, географию, аудиторию, бюджет и посадочную страницу; доступ к рекламному кабинету предоставляется владельцем."),
        ("Гарантируется ли количество заявок?", "Нет: спрос, конкуренция, предложение и бюджет меняются. До запуска можно согласовать план тестирования и критерии оценки."),
    ),
    "website-support": (
        ("Какие задачи можно передать на поддержку?", "Это могут быть технические исправления, обновление материалов и согласованные улучшения; сначала проверим доступы и состояние сайта."),
        ("Нужна ли передача доступов?", "Для выполнения работ потребуются необходимые доступы. Их перечень согласуется заранее, а передавать пароли в открытом виде не нужно."),
    ),
    "smm": (
        ("Что входит в план SMM?", "Состав зависит от площадок и целей: темы и формат публикаций, график, материалы и правила общения с аудиторией согласуются до старта."),
        ("Гарантируется ли рост подписчиков или продаж?", "Нет: такие показатели зависят от контента, аудитории, бюджета и внешних факторов. Мы согласуем задачи и способы оценки до начала работ."),
    ),
    "business-promotion": (
        ("С каких каналов начать продвижение?", "Выбор зависит от спроса, аудитории, предложения и готовности сайта. Каналы и их приоритеты определяются после обсуждения задачи."),
        ("Нужно ли подключать сразу все каналы?", "Нет. Можно начать с приоритетных направлений и расширять план по мере появления данных и ресурсов."),
    ),
    "process-automation": (
        ("Какие процессы имеет смысл автоматизировать?", "Начать стоит с повторяющихся операций и понятных правил. До разработки проверим сценарий, исключения и используемые сервисы."),
        ("Можно ли связать уже используемые сервисы?", "Возможность зависит от API, тарифов и ограничений платформ. Совместимость нужно проверить до согласования реализации."),
    ),
    "telegram-mini-app": (
        ("Когда подходит Telegram Mini App?", "Когда ключевой сценарий удобно выполнять внутри Telegram: например, просматривать каталог, отправлять заявку или записываться."),
        ("Нужен ли для Mini App отдельный сервер или интеграции?", "Зависит от функций. Данные, авторизация, платежи и интеграции определяются после описания сценариев и проверки ограничений платформ."),
    ),
    "digital-products": (
        ("Чем цифровой продукт отличается от обычного сайта?", "Это решение с логикой и пользовательскими сценариями: например, личный кабинет или веб-инструмент. Границы продукта определяются задачей."),
        ("Как определить первую версию продукта?", "Сначала выделяют основную пользовательскую задачу и обязательные функции, затем согласуют объём первой версии и возможные следующие этапы."),
    ),
    "chatbots": (
        ("Какие задачи можно поручить чат-боту?", "Бот может отвечать на типовые вопросы, собирать обращения или направлять диалог сотруднику. Сценарий нужно сверить с процессом компании."),
        ("Может ли бот передавать разговор сотруднику?", "Такой сценарий можно рассмотреть; способ передачи зависит от используемого мессенджера и инструментов команды."),
    ),
}

SERVICE_FAQS_EN = {
    "seo": (
        ("Where does SEO work begin?", "We review the website's technical state, indexation and search structure, then agree on priorities and a work plan."),
        ("Can you guarantee quick top rankings?", "No timeline or ranking can be guaranteed: outcomes depend on competition, the website, demand and ongoing work."),
    ),
    "website-development": (
        ("What should I prepare for a website project?", "It helps to outline the website's goals, audience, services and desired visitor action. Content and materials can be discussed as part of the scope."),
        ("Can you help after launch?", "Yes. Maintenance and further improvements can be agreed as a separate phase."),
    ),
    "contextual-advertising": (
        ("What is needed before an ad campaign starts?", "We should agree on the target action, locations, audience, budget and landing page. The account owner provides access to the advertising account."),
        ("Can you guarantee a number of enquiries?", "No. Demand, competition, the offer and budget change. Testing goals and evaluation criteria can be agreed before launch."),
    ),
    "website-support": (
        ("What can be included in website maintenance?", "The scope may include technical fixes, content updates and agreed improvements. We first review access and the site's current state."),
        ("Will you need access to the website?", "Required access is agreed in advance. Passwords should not be sent in plain text."),
    ),
    "smm": (
        ("What goes into an SMM plan?", "The plan depends on platforms and goals. Topics, formats, publishing schedule, materials and audience communication are agreed before work begins."),
        ("Can you guarantee follower or sales growth?", "No. Those outcomes depend on content, audience, budget and external factors. Goals and evaluation methods are agreed in advance."),
    ),
    "business-promotion": (
        ("Which digital channels should we start with?", "The choice depends on demand, audience, the offer and website readiness. Priorities are set after discussing your needs."),
        ("Do we need to use every channel at once?", "No. Work can begin with the priority channels and expand when there is enough data and capacity."),
    ),
    "process-automation": (
        ("Which processes are worth automating?", "Start with repetitive tasks and clear rules. We review the workflow, exceptions and tools before planning implementation."),
        ("Can you connect the tools we already use?", "That depends on APIs, plans and platform limitations. Compatibility should be checked before implementation is agreed."),
    ),
    "telegram-mini-app": (
        ("When is a Telegram Mini App a good fit?", "When a core user journey works well inside Telegram, such as browsing a catalogue, sending an enquiry or booking."),
        ("Does a Mini App need a separate backend or integrations?", "That depends on its features. Data, authentication, payments and integrations are defined after reviewing the required flows and platform constraints."),
    ),
    "digital-products": (
        ("How is a digital product different from a standard website?", "It includes product logic and user workflows, such as an account area or web tool. The product boundaries depend on the problem to solve."),
        ("How do we define the first product release?", "We identify the primary user need and essential features, then agree on the first release scope and possible next steps."),
    ),
    "chatbots": (
        ("What tasks can a chatbot handle?", "A bot can answer common questions, collect enquiries or hand a conversation to a staff member. The flow should fit the team's process."),
        ("Can the bot hand a conversation to a person?", "This can be considered; the handoff method depends on the messaging platform and the team's tools."),
    ),
}


@app.before_request
def create_content_security_nonce():
    g.csp_nonce = secrets.token_urlsafe(18)


@app.after_request
def set_security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{g.csp_nonce}'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; "
        "img-src 'self' data:; connect-src 'self'; "
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.path == "/health" or request.path.startswith("/api/"):
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    if request.is_secure:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.context_processor
def add_page_metadata():
    path = request.path
    root_url = PUBLIC_SITE_URL or request.url_root.rstrip("/")
    return {
        "language": "en" if path == "/en" or path.startswith("/en/") else "ru",
        "canonical_url": f"{root_url}{path}",
        "site_root_url": root_url,
        "csp_nonce": g.csp_nonce,
    }


def send_to_telegram(name, phone, task=""):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        raise RuntimeError("Telegram integration is not configured")

    message = f"Новая заявка!\n\nИмя: {name}\nКонтакт: {phone}"
    if task:
        message += f"\nЗадача: {task}"
    message += "\nСогласие на обработку персональных данных: дано через форму."
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    response = requests.post(
        url,
        json={"chat_id": TELEGRAM_CHAT_ID, "text": message},
        timeout=(3, 10),
    )
    response.raise_for_status()

    result = response.json()
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise ValueError("Telegram API rejected the notification")


PROJECTS_BY_SLUG = {
    "splav-po-mane": {
        "title": "Сплав по Мане",
        "description": "Сайт туристического проекта о сплавах по Мане. Описание подтверждённых функций и технологий уточняется.",
        "kind": "Реализованный веб-проект",
        "summary": "Публичный сайт туристического проекта о сплавах по Мане.",
        "challenge": "Представить туристическое предложение в интернете. Детали исходного технического задания не предоставлены.",
        "solution": "В работе можно проверить сайт проекта и его опубликованную информацию. Подробный перечень реализованных агентством функций требует сверки с владельцем.",
        "features": [
            "Публичная страница проекта доступна по внешней ссылке.",
            "Описание отдельных функций сайта требует дополнительной проверки.",
        ],
        "technologies": [],
        "image": None,
        "image_alt": "",
        "external_url": "https://xn--80aafn0aiiffdr.xn--p1ai/",
        "external_label": "Открыть сайт проекта",
        "status_note": "Сайт доступен для просмотра; технологии, состав работ и дополнительные функции не подтверждены.",
    },
    "cvety-ryadom": {
        "title": "Цветы рядом",
        "description": "Telegram Mini App интернет-магазина цветов: каталог, оформление заказов и инструменты управления.",
        "kind": "Реализованный проект",
        "summary": "Магазин цветов внутри Telegram с пользовательскими и административными сценариями.",
        "challenge": "Собрать путь от выбора букета до оформления и отслеживания заказа в одном удобном интерфейсе Telegram.",
        "solution": "Telegram Mini App с каталогом и карточками товаров, корзиной, оформлением заказа, выбором доставки или самовывоза и административным управлением.",
        "features": [
            "Каталог товаров и карточки букетов.",
            "Корзина и оформление заказа.",
            "Платёжная интеграция, доставка и самовывоз.",
            "Просмотр статуса заказа и управление заказами.",
            "Административная панель и Telegram-администрирование.",
            "AI-консультант; отдельный экран этого сценария не представлен на опубликованном изображении.",
        ],
        "technologies": ["React", "TypeScript", "Python", "FastAPI", "aiogram 3", "PostgreSQL"],
        "image": "cases/flowers-miniapp-optimized.jpg",
        "image_alt": "Обзор экранов Telegram Mini App магазина «Цветы рядом»",
        "external_url": "https://t.me/floverkrskbot",
        "external_label": "Открыть магазин в Telegram",
        "status_note": "Описание возможностей и технологического стека основано на информации владельца проекта. Доступность платежей и других внешних интеграций зависит от их актуальной настройки.",
    },
    "lusolink": {
        "title": "LusoLink",
        "description": "Собственный образовательный цифровой продукт для изучения бразильского португальского и русского языков.",
        "kind": "Собственный цифровой продукт",
        "summary": "Образовательная платформа для русскоязычных изучающих бразильский португальский и бразильцев, изучающих русский.",
        "challenge": "Создать цифровую среду для языкового обучения между русскоязычной и бразильской аудиториями.",
        "solution": "Собственный продукт агентства. Конкретный перечень готовых пользовательских функций и публичная демонстрация пока не подтверждены.",
        "features": [
            "Направление продукта: бразильский португальский для русскоязычных пользователей.",
            "Направление продукта: русский язык для бразильских пользователей.",
        ],
        "technologies": ["React", "TypeScript", "Python", "Backend API"],
        "image": None,
        "image_alt": "",
        "external_url": None,
        "external_label": "",
        "status_note": "Сведения о готовности отдельных функций и действующей публичной версии требуют подтверждения; неподтверждённые сценарии не описываем как работающие.",
    },
    "digital-agency-ai": {
        "title": "Digital Agency AI",
        "description": "Собственная цифровая платформа агентства: сайт услуг, портфолио, SEO-страницы и сценарий обращения.",
        "kind": "Собственный цифровой продукт",
        "summary": "Сайт и цифровая платформа Digital Agency AI для представления услуг и связи с агентством.",
        "challenge": "Понятно представить направления агентства, помочь клиенту выбрать услугу и подготовить обращение.",
        "solution": "Многостраничный сайт с маршрутами услуг, русской и английской версиями, формой обращения и техническими SEO-страницами.",
        "features": [
            "Отдельные маршруты услуг и связанных материалов.",
            "Русская и английская версии сайта.",
            "Форма обращения с серверной проверкой и согласием на обработку данных.",
            "robots.txt, sitemap.xml и canonical-метаданные.",
        ],
        "technologies": ["Flask", "Python", "PHP", "HTML", "CSS", "JavaScript"],
        "image": None,
        "image_alt": "",
        "external_url": None,
        "external_label": "",
        "status_note": "Это собственный продукт агентства, не клиентский кейс. Перечень функций описывает текущую реализацию исходного проекта.",
    },
}

INDUSTRIES_BY_SLUG = {
    "beauty": {
        "title": "Салоны красоты",
        "meta_title": "Сайт и онлайн-запись для салона красоты | Digital Agency AI",
        "description": "Сайты, онлайн-запись, Telegram-инструменты и продвижение для салонов красоты. Работаем дистанционно с Красноярском и другими регионами.",
        "lead": "Цифровые инструменты для записи, представления услуг и общения с клиентами салона.",
        "problems": [
            "Клиенту трудно быстро найти услуги, цены и свободный способ записи.",
            "Запросы поступают в разные каналы и требуют ручного переноса.",
            "Нет единого визуального представления услуг и работ.",
        ],
        "solutions": [
            "Сайт с описанием услуг, мастеров и понятными контактами.",
            "Онлайн-запись или Telegram-сценарий после проверки расписания и интеграций.",
            "UI/UX-дизайн, оформление материалов и отдельное SEO или SMM-сопровождение.",
        ],
        "service_slugs": ["website-development", "telegram-mini-app", "website-support", "smm"],
        "example_title": "Nail Studio — демо-концепт",
        "example_note": "Визуальная демонстрация сайта и сценария записи; это не подтверждённый клиентский кейс.",
        "example_url": "/#cases",
        "notice": "",
    },
    "medical": {
        "title": "Медицинские центры",
        "meta_title": "Сайт и цифровые инструменты для медицинского центра | Digital Agency AI",
        "description": "Разработка сайтов и цифровых сценариев для медицинских центров: структура услуг, контакты, запись и техническая подготовка.",
        "lead": "Помогаем представить направления и сделать путь пациента к контактам и записи понятнее.",
        "problems": [
            "Посетителю сложно разобраться в направлениях, специалистах и порядке записи.",
            "Информация о клинике разнесена по нескольким страницам и каналам.",
            "Сайт не подготовлен технически к дальнейшему поисковому продвижению.",
        ],
        "solutions": [
            "Структура сайта по направлениям и страницам услуг.",
            "Понятные контактные и записные сценарии без лишнего сбора чувствительных данных.",
            "Техническая оптимизация и SEO-план после анализа сайта и поискового спроса.",
        ],
        "service_slugs": ["website-development", "website-support", "seo", "contextual-advertising"],
        "example_title": "",
        "example_note": "Подтверждённый проект медицинского центра в портфолио пока не представлен.",
        "example_url": "",
        "notice": "Сбор и обработка медицинских и иных чувствительных данных требуют отдельной правовой и технической оценки. До такой оценки не размещайте их в формах сайта.",
    },
    "construction": {
        "title": "Строительные компании",
        "meta_title": "Сайт и автоматизация для строительной компании | Digital Agency AI",
        "description": "Сайты, каталоги работ, сбор обращений и автоматизация процессов для строительных компаний Красноярска и края.",
        "lead": "Цифровые решения, которые помогают показать услуги, объекты и следующий шаг для потенциального заказчика.",
        "problems": [
            "Портфолио объектов и услуг трудно обновлять и показывать с телефона.",
            "Обращения теряются между сайтом, мессенджерами и сотрудниками.",
            "Клиенту не хватает ясного описания этапов, специализации и географии работ.",
        ],
        "solutions": [
            "Сайт-каталог с направлениями, реализованными объектами и формой запроса.",
            "Интеграции с CRM и автоматизация передачи обращений после проверки доступных API.",
            "Техническая база для SEO и рекламы без обещаний позиций или количества заявок.",
        ],
        "service_slugs": ["website-development", "digital-products", "process-automation", "seo"],
        "example_title": "",
        "example_note": "Подтверждённый проект строительной компании в портфолио пока не представлен.",
        "example_url": "",
        "notice": "",
    },
    "tourism": {
        "title": "Туристический бизнес",
        "meta_title": "Сайт и цифровые решения для туризма | Digital Agency AI",
        "description": "Сайты и цифровые сценарии для туристических проектов: описание предложений, контакты и путь к обращению.",
        "lead": "Помогаем туристическому проекту ясно представить поездки и упростить путь от интереса до обращения.",
        "problems": [
            "Гостю сложно быстро понять формат поездки, условия и следующий шаг.",
            "Материалы о маршруте, проживании и трансфере разбросаны по разным каналам.",
            "Команде приходится вручную обрабатывать повторяющиеся вопросы и заявки.",
        ],
        "solutions": [
            "Сайт с программой, описанием условий, визуальными материалами и контактами.",
            "Формы обращения или Telegram-сценарии, согласованные с реальным процессом бронирования.",
            "Техническая оптимизация и SEO-структура для туристических запросов.",
        ],
        "service_slugs": ["website-development", "telegram-mini-app", "seo", "smm"],
        "example_title": "Сплав по Мане",
        "example_note": "Публичный сайт туристического проекта. Детали выполненных работ и функции требуют дополнительного подтверждения.",
        "example_url": "https://xn--80aafn0aiiffdr.xn--p1ai/",
        "notice": "",
    },
}


@app.route("/")
def home():
    return render_template("index.html", services=SERVICE_CATALOG)


@app.route("/en")
def home_en():
    return render_template("index_en.html", services=SERVICE_CATALOG_EN)


@app.route("/projects/<slug>")
def project_detail(slug):
    project = PROJECTS_BY_SLUG.get(slug)
    if project is None:
        abort(404)
    return render_template("project.html", project=project)


@app.route("/industries/")
def industries():
    return render_template("industries.html", industries=INDUSTRIES_BY_SLUG)


@app.route("/industries/<slug>/")
def industry_detail(slug):
    industry = INDUSTRIES_BY_SLUG.get(slug)
    if industry is None:
        abort(404)
    related_services = [SERVICES_BY_SLUG[item] for item in industry["service_slugs"]]
    return render_template(
        "industry.html",
        industry=industry,
        related_services=related_services,
    )


@app.route("/services/<slug>")
def service_detail(slug):
    service = SERVICES_BY_SLUG.get(slug)
    if service is None:
        abort(404)
    related_services = [SERVICES_BY_SLUG[item] for item in RELATED_SERVICE_SLUGS[slug]]
    return render_template(
        "service.html",
        service=service,
        related_services=related_services,
        service_faqs=SERVICE_FAQS[slug],
    )


@app.route("/en/services/<slug>")
def service_detail_en(slug):
    service = SERVICES_EN_BY_SLUG.get(slug)
    if service is None:
        abort(404)
    related_services = [SERVICES_EN_BY_SLUG[item] for item in RELATED_SERVICE_SLUGS[slug]]
    return render_template(
        "service_en.html",
        service=service,
        related_services=related_services,
        service_faqs=SERVICE_FAQS_EN[slug],
    )


@app.route("/privacy")
def privacy_policy():
    return render_template("privacy.html")


@app.route("/en/privacy")
def privacy_policy_en():
    return render_template("privacy_en.html")


@app.route("/robots.txt")
def robots():
    base_url = PUBLIC_SITE_URL or request.url_root.rstrip("/")
    response = make_response(
        f"User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /health\nSitemap: {base_url}/sitemap.xml\n",
        200,
    )
    response.mimetype = "text/plain"
    return response


@app.route("/sitemap.xml")
def sitemap():
    root_url = PUBLIC_SITE_URL or request.url_root.rstrip("/")
    localized_pages = [
        ("/", "/en"),
        ("/privacy", "/en/privacy"),
    ]
    for slug in SERVICES_BY_SLUG:
        localized_pages.append((f"/services/{slug}", f"/en/services/{slug}"))

    url_entries = []
    for ru_path, en_path in localized_pages:
        alternate_links = (
            f'<xhtml:link rel="alternate" hreflang="ru-RU" href="{escape(root_url + ru_path)}"/>'
            f'<xhtml:link rel="alternate" hreflang="en" href="{escape(root_url + en_path)}"/>'
            f'<xhtml:link rel="alternate" hreflang="x-default" href="{escape(root_url + ru_path)}"/>'
        )
        for path in (ru_path, en_path):
            url_entries.append(
                f"<url><loc>{escape(root_url + path)}</loc>{alternate_links}</url>"
            )
    for slug in PROJECTS_BY_SLUG:
        url_entries.append(f"<url><loc>{escape(root_url + '/projects/' + slug)}</loc></url>")
    url_entries.append(f"<url><loc>{escape(root_url + '/industries/')}</loc></url>")
    for slug in INDUSTRIES_BY_SLUG:
        url_entries.append(
            f"<url><loc>{escape(root_url + '/industries/' + slug + '/')}</loc></url>"
        )
    urls = "".join(url_entries)
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
        f"{urls}</urlset>"
    )
    response = make_response(xml, 200)
    response.mimetype = "application/xml"
    return response


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/audit", methods=["POST"])
def get_audit():
    is_english = request.path.startswith("/en/") or request.args.get("lang") == "en"

    def error(message_ru, message_en, status):
        return jsonify({
            "status": "error",
            "message": message_en if is_english else message_ru,
        }), status

    if not request.is_json:
        return error("Ожидается JSON-запрос.", "A JSON request is required.", 415)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error("Проверьте данные формы.", "Please check the form details.", 400)

    name = data.get("name")
    phone = data.get("phone")
    task = data.get("task", "")
    consent = data.get("consent")
    if (
        not isinstance(name, str)
        or not isinstance(phone, str)
        or not isinstance(task, str)
        or not isinstance(consent, bool)
    ):
        return error("Проверьте поля формы.", "Please check the form fields.", 400)

    name = name.strip()
    phone = phone.strip()
    task = task.strip()
    if (
        not name
        or len(name) > 120
        or not phone
        or len(phone) > 120
        or not task
        or len(task) > 1000
        or not consent
    ):
        return error("Проверьте данные формы.", "Please check the form details.", 400)

    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        current_app.logger.error("Audit submission rejected: Telegram is not configured")
        return error(
            "Форма временно недоступна. Попробуйте позже.",
            "The form is temporarily unavailable. Please try again later.",
            503,
        )

    try:
        send_to_telegram(name, phone, task)
    except requests.RequestException:
        current_app.logger.error("Failed to deliver audit submission to Telegram")
        return error(
            "Не удалось отправить заявку. Попробуйте позже.",
            "We couldn't send your request. Please try again later.",
            502,
        )
    except (ValueError, RuntimeError):
        current_app.logger.error("Telegram rejected the audit submission")
        return error(
            "Не удалось отправить заявку. Попробуйте позже.",
            "We couldn't send your request. Please try again later.",
            502,
        )

    return jsonify({
        "status": "success",
        "message": (
            "Thank you! Your request has been sent. We will contact you using the details provided."
            if is_english
            else "Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному контакту."
        ),
    })


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "8000")),
        debug=False,
    )
