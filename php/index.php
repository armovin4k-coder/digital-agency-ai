<?php

$configPath = __DIR__ . '/config.php';
$config = file_exists($configPath) ? require $configPath : array();
if (!is_array($config)) {
    http_response_code(500);
    exit('Invalid PHP site configuration.');
}

function app_json_response($status, $payload)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function app_error_message($isEnglish, $messageRu, $messageEn)
{
    return $isEnglish ? $messageEn : $messageRu;
}

function app_text_length($value)
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }

    $length = preg_match_all('/./us', $value, $matches);
    return $length === false ? null : $length;
}

function app_send_telegram($token, $chatId, $name, $contact, $task)
{
    $message = "Новая заявка!\n\nИмя: " . $name . "\nКонтакт: " . $contact;
    if ($task !== '') {
        $message .= "\nЗадача: " . $task;
    }
    $message .= "\nСогласие на обработку персональных данных: дано через форму.";

    $payload = json_encode(
        array('chat_id' => $chatId, 'text' => $message),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if ($payload === false) {
        error_log('Telegram notification payload could not be encoded.');
        return false;
    }

    $context = stream_context_create(array(
        'http' => array(
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n"
                . 'Content-Length: ' . strlen($payload) . "\r\n",
            'content' => $payload,
            'timeout' => 10,
            'ignore_errors' => true,
        ),
        'ssl' => array(
            'verify_peer' => true,
            'verify_peer_name' => true,
        ),
    ));

    $responseBody = @file_get_contents(
        'https://api.telegram.org/bot' . $token . '/sendMessage',
        false,
        $context
    );
    if ($responseBody === false) {
        error_log('Telegram notification could not be delivered.');
        return false;
    }

    $response = json_decode($responseBody, true);
    if (!is_array($response) || !isset($response['ok']) || $response['ok'] !== true) {
        error_log('Telegram rejected a website enquiry.');
        return false;
    }

    return true;
}

function app_handle_audit($config, $isEnglish, $isHttps)
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');
        app_json_response(405, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Метод запроса не поддерживается.', 'This request method is not supported.'),
        ));
    }

    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > 16384) {
        app_json_response(413, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Запрос слишком большой.', 'The request is too large.'),
        ));
    }

    $contentType = isset($_SERVER['CONTENT_TYPE']) ? strtolower($_SERVER['CONTENT_TYPE']) : '';
    if (strpos($contentType, 'application/json') !== 0) {
        app_json_response(415, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Ожидается JSON-запрос.', 'A JSON request is required.'),
        ));
    }

    $rawBody = file_get_contents('php://input', false, null, 0, 16385);
    if ($rawBody === false || strlen($rawBody) > 16384) {
        app_json_response(400, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Проверьте данные формы.', 'Please check the form details.'),
        ));
    }

    $data = json_decode($rawBody, true);
    if (!is_array($data)
        || !isset($data['name'], $data['phone'], $data['task'], $data['consent'])
        || !is_string($data['name'])
        || !is_string($data['phone'])
        || !is_string($data['task'])
        || !is_bool($data['consent'])) {
        app_json_response(400, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Проверьте поля формы.', 'Please check the form fields.'),
        ));
    }

    $name = trim($data['name']);
    $contact = trim($data['phone']);
    $task = trim($data['task']);
    $nameLength = app_text_length($name);
    $contactLength = app_text_length($contact);
    $taskLength = app_text_length($task);
    if ($name === '' || $contact === '' || $task === ''
        || $nameLength === null || $nameLength > 120
        || $contactLength === null || $contactLength > 120
        || $taskLength === null || $taskLength > 1000
        || $data['consent'] !== true) {
        app_json_response(400, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Проверьте данные формы.', 'Please check the form details.'),
        ));
    }

    $token = isset($config['telegram_bot_token'])
        ? trim($config['telegram_bot_token'])
        : trim((string) getenv('TELEGRAM_BOT_TOKEN'));
    $chatId = isset($config['telegram_chat_id'])
        ? trim($config['telegram_chat_id'])
        : trim((string) getenv('TELEGRAM_CHAT_ID'));
    if ($token === '' || $chatId === '') {
        error_log('Enquiry rejected because Telegram is not configured.');
        app_json_response(503, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Форма временно недоступна. Попробуйте позже.', 'The form is temporarily unavailable. Please try again later.'),
        ));
    }

    if (!$isHttps) {
        error_log('Enquiry rejected because HTTPS is not active.');
        app_json_response(503, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Отправка формы доступна после включения HTTPS.', 'Enquiries are available after HTTPS is enabled.'),
        ));
    }

    if (!app_send_telegram($token, $chatId, $name, $contact, $task)) {
        app_json_response(502, array(
            'status' => 'error',
            'message' => app_error_message($isEnglish, 'Не удалось отправить заявку. Попробуйте позже.', 'We could not send your request. Please try again later.'),
        ));
    }

    app_json_response(200, array(
        'status' => 'success',
        'message' => app_error_message(
            $isEnglish,
            'Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному контакту.',
            'Thank you! Your request has been sent. We will contact you using the details provided.'
        ),
    ));
}

$requestPath = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
if (!is_string($requestPath) || $requestPath === '') {
    $requestPath = '/';
}
$requestPath = rawurldecode($requestPath);
if (preg_match('/[\x00-\x1F\x7F]/', $requestPath)) {
    http_response_code(400);
    exit('Invalid request path.');
}
if ($requestPath !== '/') {
    $requestPath = rtrim($requestPath, '/');
    if ($requestPath === '') {
        $requestPath = '/';
    }
}

if (PHP_SAPI === 'cli-server' && strpos($requestPath, '/static/') === 0
    && is_file(__DIR__ . $requestPath)) {
    return false;
}

$host = isset($_SERVER['HTTP_HOST']) ? strtolower($_SERVER['HTTP_HOST']) : '';
$host = preg_replace('/:\d+$/', '', $host);

$siteUrlSetting = isset($config['site_url']) ? $config['site_url'] : getenv('PUBLIC_SITE_URL');
$siteUrl = is_string($siteUrlSetting) ? rtrim(trim($siteUrlSetting), '/') : '';
$parsedSiteUrl = $siteUrl !== '' ? parse_url($siteUrl) : array();
if ($siteUrl !== ''
    && (!is_array($parsedSiteUrl)
        || !isset($parsedSiteUrl['scheme'], $parsedSiteUrl['host'])
        || !in_array(strtolower($parsedSiteUrl['scheme']), array('http', 'https'), true)
        || isset($parsedSiteUrl['user'])
        || isset($parsedSiteUrl['pass'])
        || (isset($parsedSiteUrl['path']) && $parsedSiteUrl['path'] !== '' && $parsedSiteUrl['path'] !== '/')
        || isset($parsedSiteUrl['query'])
        || isset($parsedSiteUrl['fragment']))) {
    http_response_code(500);
    exit('Invalid site URL configuration.');
}
$siteHost = $siteUrl !== '' ? parse_url($siteUrl, PHP_URL_HOST) : '';
$allowedHosts = array();
if (isset($config['allowed_hosts']) && is_array($config['allowed_hosts'])) {
    $allowedHosts = array_map('strtolower', array_map('trim', $config['allowed_hosts']));
} elseif (getenv('ALLOWED_HOSTS')) {
    $allowedHosts = array_map('strtolower', array_map('trim', explode(',', getenv('ALLOWED_HOSTS'))));
}
if (empty($allowedHosts) && is_string($siteHost) && $siteHost !== '') {
    $allowedHosts = array(strtolower($siteHost));
}
if (empty($allowedHosts) || !in_array($host, $allowedHosts, true)) {
    http_response_code(400);
    exit('Host is not configured for this website.');
}

$isHttps = (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] === '443');
$trustProxyHttps = isset($config['trust_proxy_https'])
    ? (bool) $config['trust_proxy_https']
    : getenv('TRUST_PROXY_HTTPS') === '1';
if ($trustProxyHttps && isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
    $isHttps = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https';
}
$requestIsEnglish = strpos($requestPath, '/en/') === 0 || $requestPath === '/en';

if ($siteUrl !== '' && strpos($siteUrl, 'https://') === 0 && !$isHttps) {
    $query = isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING'] !== ''
        ? '?' . $_SERVER['QUERY_STRING']
        : '';
    header('Location: ' . $siteUrl . $requestPath . $query, true, 302);
    exit;
}

$nonce = bin2hex(random_bytes(18));
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header(
    "Content-Security-Policy: default-src 'self'; "
    . "script-src 'self' 'nonce-" . $nonce . "'; "
    . "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
    . "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; "
    . "img-src 'self' data:; connect-src 'self'; "
    . "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
);
if ($isHttps) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

if ($requestPath === '/api/audit') {
    app_handle_audit($config, isset($_GET['lang']) && $_GET['lang'] === 'en', $isHttps);
}

if ($requestPath === '/health') {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    echo '{"status":"ok"}';
    exit;
}

$baseUrl = $siteUrl !== '' ? $siteUrl : (($isHttps ? 'https://' : 'http://') . $host);
if ($requestPath === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    echo "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /health\nSitemap: "
        . $baseUrl . "/sitemap.xml\n";
    exit;
}

$serviceSlugs = array(
    'seo',
    'website-development',
    'contextual-advertising',
    'website-support',
    'smm',
    'business-promotion',
    'process-automation',
    'telegram-mini-app',
    'digital-products',
    'chatbots',
);

if ($requestPath === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $localizedPages = array(array('/', '/en'), array('/privacy', '/en/privacy'));
    foreach ($serviceSlugs as $slug) {
        $localizedPages[] = array('/services/' . $slug, '/en/services/' . $slug);
    }
    $projectPaths = array(
        '/projects/splav-po-mane',
        '/projects/cvety-ryadom',
        '/projects/lusolink',
        '/projects/digital-agency-ai',
    );
    $industryPaths = array(
        '/industries/',
        '/industries/beauty/',
        '/industries/medical/',
        '/industries/construction/',
        '/industries/tourism/',
    );

    $xml = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        . 'xmlns:xhtml="http://www.w3.org/1999/xhtml">';
    foreach ($localizedPages as $pair) {
        $ruUrl = htmlspecialchars($baseUrl . $pair[0], ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $enUrl = htmlspecialchars($baseUrl . $pair[1], ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $alternates = '<xhtml:link rel="alternate" hreflang="ru-RU" href="' . $ruUrl . '"/>'
            . '<xhtml:link rel="alternate" hreflang="en" href="' . $enUrl . '"/>'
            . '<xhtml:link rel="alternate" hreflang="x-default" href="' . $ruUrl . '"/>';
        $xml .= '<url><loc>' . $ruUrl . '</loc>' . $alternates . '</url>'
            . '<url><loc>' . $enUrl . '</loc>' . $alternates . '</url>';
    }
    foreach ($projectPaths as $path) {
        $url = htmlspecialchars($baseUrl . $path, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $xml .= '<url><loc>' . $url . '</loc></url>';
    }
    foreach ($industryPaths as $path) {
        $url = htmlspecialchars($baseUrl . $path, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $xml .= '<url><loc>' . $url . '</loc></url>';
    }
    echo $xml . '</urlset>';
    exit;
}

$pageMap = array(
    '/' => 'index.html',
    '/en' => 'en.html',
    '/privacy' => 'privacy.html',
    '/en/privacy' => 'en_privacy.html',
    '/projects/splav-po-mane' => 'project_splav_po_mane.html',
    '/projects/cvety-ryadom' => 'project_cvety_ryadom.html',
    '/projects/lusolink' => 'project_lusolink.html',
    '/projects/digital-agency-ai' => 'project_digital_agency_ai.html',
    '/industries' => 'industries.html',
    '/industries/beauty' => 'industry_beauty.html',
    '/industries/medical' => 'industry_medical.html',
    '/industries/construction' => 'industry_construction.html',
    '/industries/tourism' => 'industry_tourism.html',
);
if (preg_match('~^/services/([a-z0-9-]+)$~', $requestPath, $matches)
    && in_array($matches[1], $serviceSlugs, true)) {
    $pageMap[$requestPath] = 'service_' . $matches[1] . '.html';
}
if (preg_match('~^/en/services/([a-z0-9-]+)$~', $requestPath, $matches)
    && in_array($matches[1], $serviceSlugs, true)) {
    $pageMap[$requestPath] = 'en_service_' . $matches[1] . '.html';
}

if (!isset($pageMap[$requestPath])) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found</title>'
        . '<body><h1>404</h1><p>Page not found.</p><a href="/">Home</a></body></html>';
    exit;
}

$pagePath = __DIR__ . '/pages/' . $pageMap[$requestPath];
$html = is_file($pagePath) ? file_get_contents($pagePath) : false;
if ($html === false) {
    error_log('A generated website page is missing: ' . basename($pagePath));
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Website pages are not installed. Upload the complete PHP package.');
}

$html = str_replace('__SITE_ORIGIN__', $baseUrl, $html);
$html = preg_replace('/nonce="[^"]*"/', 'nonce="' . $nonce . '"', $html);
header('Content-Type: text/html; charset=utf-8');
echo $html;
