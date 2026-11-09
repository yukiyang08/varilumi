<?php
/**
 * Plugin Name: 飛利明 開關調光體驗館 Varilumi Lab
 * Description: 在頁面中放入飛利明 開關調光體驗館。用法：[varilumi_lab]，體驗室直接畫在頁面裡、跟著網站一起捲動。若佈景主題有衝突，可改用 mode="iframe"（鋪滿頁首以下、體驗室自己捲動，可加 offset="頁首高度(px)"）。體驗室裡的操作會以 lab_ 開頭的事件送進網站的 GA。
 * Version: 1.3.0
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
            . '<div id="varilumi-lab" style="display:block;width:100vw;max-width:none;margin-left:calc(50% - 50vw);min-height:100vh"></div>'
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
