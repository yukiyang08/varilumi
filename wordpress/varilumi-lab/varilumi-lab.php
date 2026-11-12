<?php
/**
 * Plugin Name: 飛利明 開關調光體驗館 Varilumi Lab
 * Description: 在頁面中放入飛利明 開關調光體驗館。用法：[varilumi_lab]，體驗室直接畫在頁面裡、跟著網站一起捲動。若佈景主題有衝突，可改用 mode="iframe"（鋪滿頁首以下、體驗室自己捲動，可加 offset="頁首高度(px)"）。體驗室裡的操作會以 lab_ 開頭的事件送進網站的 GA。體驗好禮：玩過之後填問卷，WooCommerce 自動發一張專屬優惠券到會員帳戶（後台：WooCommerce → 體驗館問卷）。
 * Version: 1.4.0
 * Requires PHP: 7.1
 * Author: 飛利明 VariLumi
 */

if (!defined('ABSPATH')) exit;

// The lab is hosted on GitHub Pages and redeploys on every push, so the plugin never needs updating.
const VARILUMI_LAB_SRC = 'https://yukiyang08.github.io/varilumi/';

add_shortcode('varilumi_lab', function ($atts) {
    static $listener_done = false;
    $a = shortcode_atts(['src' => VARILUMI_LAB_SRC, 'offset' => '', 'mode' => 'page'], $atts, 'varilumi_lab');

    if ($a['mode'] !== 'iframe') {
        // Default: the lab is drawn right in this page (no iframe), full width, and scrolls with the site.
        // embed.js comes from GitHub Pages, so a push still updates it. It calls the site's gtag itself.
        static $mounted = false;
        if ($mounted) return ''; // one lab per page
        $mounted = true;
        return '<style>html,body{overflow-x:clip}</style>'
            . '<div id="varilumi-lab" data-wp="' . esc_attr(wp_json_encode(varilumi_lab_config())) . '" style="display:block;width:100vw;max-width:none;margin-left:calc(50% - 50vw);min-height:100vh"></div>'
            . '<script type="module" src="' . esc_url(trailingslashit($a['src']) . 'embed.js') . '"></script>';
    } else {
        // Full screen: the lab covers everything under the site header and the page itself stops scrolling,
        // so there is only one scroll (the lab's) and it feels like a normal page of the site.
        // The header height is measured (admin bar + first <header>) unless offset="" is given.
        $html = sprintf(
            '<style>html,body{overflow:hidden!important;height:100%%}</style>'
            . '<iframe id="varilumi-lab" src="%s" title="飛利明 開關調光體驗館" allow="vibrate" style="position:fixed;left:0;right:0;bottom:0;top:%dpx;width:100%%;height:auto;border:0;z-index:1;background:#fff"></iframe>',
            esc_url($a['src']),
            max(0, intval($a['offset']))
        );
        if ($a['offset'] === '') {
            $html .= '<script>(function(){var f=document.getElementById("varilumi-lab");'
                . 'function fit(){var t=0;["#wpadminbar","header"].forEach(function(s){var e=document.querySelector(s);'
                . 'if(e){var r=e.getBoundingClientRect();if(r.height&&r.top<=t+1)t=Math.max(t,r.bottom);}});'
                . 'f.style.top=Math.round(Math.max(0,t))+"px";}'
                . 'fit();window.addEventListener("load",fit);window.addEventListener("resize",fit);})();</script>';
        }
    }

    // Analytics: the lab posts { source: 'varilumi-lab', event, params } to this page; forward it to the
    // site's GA (gtag, or Google Tag Manager's dataLayer) as lab_<event>, so it shares this visit and visitor.
    if (!$listener_done) {
        $listener_done = true;
        $p = wp_parse_url($a['src']);
        $origin = (isset($p['scheme'], $p['host'])) ? $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '') : '';
        $html .= '<script>(function(){var O=' . wp_json_encode($origin) . ';'
            . 'window.addEventListener("message",function(e){'
            . 'if(e.origin!==O)return;var d=e.data;'
            . 'if(!d||d.source!=="varilumi-lab"||typeof d.event!=="string")return;'
            . 'var n="lab_"+d.event.replace(/[^a-z0-9_]/gi,"").slice(0,36),p={};'
            . 'if(d.params&&typeof d.params==="object"){for(var k in d.params){var v=d.params[k];'
            . 'if(/^[a-z0-9_]{1,40}$/i.test(k)&&(typeof v==="string"||typeof v==="number"||typeof v==="boolean"))p[k]=typeof v==="string"?v.slice(0,100):v;}}'
            . 'if(typeof window.gtag==="function")window.gtag("event",n,p);'
            . 'else{window.dataLayer=window.dataLayer||[];p.event=n;window.dataLayer.push(p);}'
            . '});})();</script>';
    }
    return $html;
});

/* ======================================================================================================
 * 體驗好禮: after trying the lab, a short survey that puts a coupon into the visitor's WooCommerce account.
 * The questions live in the lab (src/survey.ts); this side checks the visitor, issues one coupon per
 * account and keeps the answers (WooCommerce → 體驗館問卷 exports them as CSV).
 * ==================================================================================================== */

// The coupon: 滿 min 折 amount, valid for `days` days after it is issued.
const VARILUMI_LAB_OFFER = ['amount' => 100, 'min' => 1000, 'days' => 30];
// Same numbers as UNLOCK in src/survey.ts. They come from the visitor's browser, so this only stops
// casual skipping; login + one coupon per account is the real limit.
const VARILUMI_LAB_UNLOCK = ['presses' => 5, 'functions' => 2];
const VARILUMI_LAB_META = '_varilumi_lab_survey';

/** What the lab needs to know on this page view (passed as data-wp). */
function varilumi_lab_config() {
    $here = get_permalink() ?: home_url('/');
    $back = add_query_arg('vl_survey', '1', $here);
    $uid = get_current_user_id();
    return [
        'api' => esc_url_raw(rest_url('varilumi-lab/v1/survey')),
        'nonce' => $uid ? wp_create_nonce('wp_rest') : '',
        'login' => function_exists('wc_get_page_permalink')
            ? add_query_arg('vl_return', rawurlencode($back), wc_get_page_permalink('myaccount'))
            : wp_login_url($back),
        'shop' => class_exists('WC_Coupon'),
        'privacy' => function_exists('get_privacy_policy_url') ? get_privacy_policy_url() : '',
        'offer' => VARILUMI_LAB_OFFER,
        'claimed' => $uid ? varilumi_lab_claimed($uid) : null,
    ];
}

/** The visitor's coupon, or null. */
function varilumi_lab_claimed($uid) {
    $s = get_user_meta($uid, VARILUMI_LAB_META, true);
    if (empty($s['coupon']) || !class_exists('WC_Coupon')) return null;
    $c = new WC_Coupon($s['coupon']);
    if (!$c->get_id()) return null; // deleted in the admin
    $exp = $c->get_date_expires();
    return [
        'code' => $c->get_code(),
        'expires' => $exp ? $exp->date_i18n('Y-m-d') : null,
        'used' => $c->get_usage_count() > 0,
    ];
}

// After logging in / registering from the lab's survey, go back to the lab (WooCommerce's own login form
// posts to its current URL, so ?vl_return is still there).
function varilumi_lab_return($redirect) {
    if (empty($_GET['vl_return'])) return $redirect;
    return wp_validate_redirect(esc_url_raw(wp_unslash($_GET['vl_return'])), $redirect);
}
add_filter('woocommerce_login_redirect', 'varilumi_lab_return', 20);
add_filter('woocommerce_registration_redirect', 'varilumi_lab_return', 20);

add_action('rest_api_init', function () {
    register_rest_route('varilumi-lab/v1', '/survey', [
        'methods' => 'POST',
        'permission_callback' => function () {
            return is_user_logged_in() ?: new WP_Error('login_required', '請先登入會員再領取優惠券', ['status' => 401]);
        },
        'callback' => 'varilumi_lab_survey',
    ]);
});

function varilumi_lab_survey(WP_REST_Request $req) {
    if (!class_exists('WC_Coupon')) return new WP_Error('no_shop', '商店暫時無法發放優惠券，請稍後再試', ['status' => 503]);
    $uid = get_current_user_id();
    if ($done = varilumi_lab_claimed($uid)) return $done; // one per account: show the one they have

    // answers: [[question, answer], ...] as sent by the lab
    $answers = [];
    foreach (array_slice((array) $req->get_param('answers'), 0, 30) as $pair) {
        if (!is_array($pair) || count($pair) !== 2) continue;
        $q = sanitize_text_field(mb_substr((string) $pair[0], 0, 100));
        $a = sanitize_textarea_field(mb_substr((string) $pair[1], 0, 300));
        if ($q !== '') $answers[$q] = $a;
    }
    if (!$answers) return new WP_Error('empty', '問卷內容是空的', ['status' => 400]);
    $tried = array_values(array_unique(array_map('sanitize_key', array_slice((array) $req->get_param('tried'), 0, 10))));
    $presses = max(0, intval($req->get_param('presses')));
    if ($presses < VARILUMI_LAB_UNLOCK['presses'] || count($tried) < VARILUMI_LAB_UNLOCK['functions']) {
        return new WP_Error('not_yet', '再多體驗一下開關調光，就能領取囉', ['status' => 403]);
    }

    // a double click / two tabs must not issue two coupons
    if (!add_user_meta($uid, '_varilumi_lab_lock', time(), true)) {
        return new WP_Error('busy', '正在處理，請稍候再重新整理頁面', ['status' => 409]);
    }
    try {
        do {
            $code = 'VL' . strtoupper(wp_generate_password(8, false, false));
        } while (wc_get_coupon_id_by_code($code));
        $user = wp_get_current_user();
        $c = new WC_Coupon();
        $c->set_code($code);
        $c->set_discount_type('fixed_cart');
        $c->set_amount(VARILUMI_LAB_OFFER['amount']);
        $c->set_minimum_amount(VARILUMI_LAB_OFFER['min']);
        $c->set_usage_limit(1);
        $c->set_usage_limit_per_user(1);
        $c->set_email_restrictions([$user->user_email]);
        $c->set_date_expires(time() + VARILUMI_LAB_OFFER['days'] * DAY_IN_SECONDS);
        $c->set_description(sprintf('開關調光體驗館問卷優惠（會員 #%d）', $uid));
        $c->save();
        update_user_meta($uid, VARILUMI_LAB_META, [
            'time' => current_time('mysql'),
            'coupon' => $code,
            'tried' => $tried,
            'presses' => $presses,
            'answers' => $answers,
        ]);
    } catch (Exception $e) {
        return new WP_Error('coupon_failed', '優惠券建立失敗，請稍後再試', ['status' => 500]);
    } finally {
        delete_user_meta($uid, '_varilumi_lab_lock'); // from now on the saved coupon itself blocks a second one
    }
    return varilumi_lab_claimed($uid);
}

// 我的帳戶: show the lab coupon on the dashboard
add_action('woocommerce_account_dashboard', function () {
    $c = varilumi_lab_claimed(get_current_user_id());
    if (!$c) return;
    printf(
        '<div class="woocommerce-info" style="margin-top:1em">開關調光體驗館優惠券：<strong style="letter-spacing:.06em">%s</strong>（滿 %s 折 %s%s）%s</div>',
        esc_html($c['code']),
        esc_html(number_format(VARILUMI_LAB_OFFER['min'])),
        esc_html(VARILUMI_LAB_OFFER['amount']),
        $c['expires'] ? esc_html('，' . $c['expires'] . ' 到期') : '',
        $c['used'] ? '・已使用' : '・結帳時輸入即可使用'
    );
});

// WooCommerce → 體驗館問卷: how many answered, and a CSV download (opens in Excel)
add_action('admin_menu', function () {
    add_submenu_page('woocommerce', '體驗館問卷', '體驗館問卷', 'manage_woocommerce', 'varilumi-lab-survey', function () {
        $n = count(get_users(['meta_key' => VARILUMI_LAB_META, 'fields' => 'ID']));
        $url = wp_nonce_url(admin_url('admin-post.php?action=varilumi_lab_csv'), 'varilumi_lab_csv');
        echo '<div class="wrap"><h1>開關調光體驗館問卷</h1>';
        printf('<p>目前共有 <strong>%d</strong> 位會員填寫並領取優惠券。</p>', $n);
        printf('<p><a class="button button-primary" href="%s">下載 CSV</a></p></div>', esc_url($url));
    });
});
add_action('admin_post_varilumi_lab_csv', function () {
    if (!current_user_can('manage_woocommerce') || !check_admin_referer('varilumi_lab_csv')) wp_die('沒有權限');
    $rows = [];
    $questions = [];
    foreach (get_users(['meta_key' => VARILUMI_LAB_META]) as $u) {
        $s = get_user_meta($u->ID, VARILUMI_LAB_META, true);
        if (!is_array($s)) continue;
        $c = varilumi_lab_claimed($u->ID);
        $rows[] = [$s, $u, $c];
        foreach (array_keys((array) $s['answers']) as $q) $questions[$q] = true;
    }
    $questions = array_keys($questions);
    nocache_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=varilumi-lab-survey-' . gmdate('Ymd') . '.csv');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM, so Excel reads the Chinese correctly
    fputcsv($out, array_merge(['填寫時間', '會員ID', 'Email', '優惠碼', '已使用', '試過的功能', '操作次數'], $questions));
    foreach ($rows as [$s, $u, $c]) {
        $line = [$s['time'], $u->ID, $u->user_email, $s['coupon'], ($c && $c['used']) ? '是' : '否', implode(' ', (array) $s['tried']), $s['presses']];
        foreach ($questions as $q) $line[] = isset($s['answers'][$q]) ? $s['answers'][$q] : '';
        // a leading = + - @ would run as a formula in Excel
        fputcsv($out, array_map(function ($v) { return preg_match('/^[=+\-@]/', (string) $v) ? "'" . $v : $v; }, $line));
    }
    fclose($out);
    exit;
});
