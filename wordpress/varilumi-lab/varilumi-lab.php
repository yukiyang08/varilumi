<?php
/**
 * Plugin Name: 開關調光體驗室 Varilumi Lab
 * Description: 在頁面中嵌入開關調光體驗室。用法：[varilumi_lab]，可加 src="網址"、offset="頁首高度(px)"。
 * Version: 1.0.0
 * Author: 飛利明 VariLumi
 */

if (!defined('ABSPATH')) exit;

// The lab is hosted on GitHub Pages and redeploys on every push, so the plugin never needs updating.
const VARILUMI_LAB_SRC = 'https://yukiyang08.github.io/varilumi/';

add_shortcode('varilumi_lab', function ($atts) {
    $a = shortcode_atts(['src' => VARILUMI_LAB_SRC, 'offset' => '0'], $atts, 'varilumi_lab');
    $offset = max(0, intval($a['offset']));
    // Fill the visible screen (minus the theme's header) so the phone layout's bottom switch stays in reach.
    $h = $offset ? "calc(100dvh - {$offset}px)" : '100dvh';
    return sprintf(
        '<iframe src="%s" title="開關調光體驗室" loading="lazy" allow="vibrate" style="display:block;width:100%%;height:100vh;height:%s;min-height:560px;border:0"></iframe>',
        esc_url($a['src']),
        esc_attr($h)
    );
});
