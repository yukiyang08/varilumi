<?php
/**
 * Plugin Name: 開關調光體驗室 Varilumi Lab
 * Description: 在頁面中嵌入開關調光體驗室。用法：[varilumi_lab]，可加 src="網址"、offset="頁首高度(px)"。體驗室裡的操作會以 lab_ 開頭的事件送進網站的 GA。
 * Version: 1.1.0
 * Author: 飛利明 VariLumi
 */

if (!defined('ABSPATH')) exit;

// The lab is hosted on GitHub Pages and redeploys on every push, so the plugin never needs updating.
const VARILUMI_LAB_SRC = 'https://yukiyang08.github.io/varilumi/';

add_shortcode('varilumi_lab', function ($atts) {
    static $listener_done = false;
    $a = shortcode_atts(['src' => VARILUMI_LAB_SRC, 'offset' => '0'], $atts, 'varilumi_lab');
    $offset = max(0, intval($a['offset']));
    // Fill the visible screen (minus the theme's header) so the phone layout's bottom switch stays in reach.
    $h = $offset ? "calc(100dvh - {$offset}px)" : '100dvh';
    $html = sprintf(
        '<iframe src="%s" title="開關調光體驗室" loading="lazy" allow="vibrate" style="display:block;width:100%%;height:100vh;height:%s;min-height:560px;border:0"></iframe>',
        esc_url($a['src']),
        esc_attr($h)
    );

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
