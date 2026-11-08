<?php

namespace App\Services;

/**
 * Sanitiza o HTML do rich editor com whitelist (guia §4):
 * b, span[style: color|text-transform|font-weight], mark[class=hl], br, div.
 * Nada de script/iframe/on*.
 */
class HtmlSanitizer
{
    private const ALLOWED_COLORS = ['#fa4d4d', '#ff8c00', '#f5c400', '#28cd41', '#007aff', '#bf5af2'];

    private const ALLOWED_TAGS = ['b', 'span', 'mark', 'br', 'div'];

    public function sanitize(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return $html === null ? null : '';
        }

        $doc = new \DOMDocument;
        libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<?xml encoding="utf-8"?><body>'.$html.'</body>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        libxml_clear_errors();

        $body = $doc->getElementsByTagName('body')->item(0);
        if ($body === null) {
            return '';
        }

        $this->cleanNode($body, $doc);

        $out = '';
        foreach (iterator_to_array($body->childNodes) as $child) {
            $out .= $doc->saveHTML($child);
        }

        return $out;
    }

    private function cleanNode(\DOMNode $node, \DOMDocument $doc): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof \DOMElement) {
                $tag = strtolower($child->tagName);

                if (! in_array($tag, self::ALLOWED_TAGS, true)) {
                    // desembrulha: mantém o conteúdo, remove a tag
                    $this->cleanNode($child, $doc);
                    while ($child->firstChild) {
                        $node->insertBefore($child->firstChild, $child);
                    }
                    $node->removeChild($child);

                    continue;
                }

                $this->cleanAttributes($child, $tag);
                $this->cleanNode($child, $doc);
            } elseif (! ($child instanceof \DOMText)) {
                $node->removeChild($child); // comentários, CDATA etc.
            }
        }
    }

    private function cleanAttributes(\DOMElement $el, string $tag): void
    {
        foreach (iterator_to_array($el->attributes) as $attr) {
            $name = strtolower($attr->name);

            if ($tag === 'span' && $name === 'style') {
                $clean = $this->cleanStyle($attr->value);
                if ($clean === '') {
                    $el->removeAttribute($attr->name);
                } else {
                    $el->setAttribute('style', $clean);
                }

                continue;
            }

            if ($tag === 'mark' && $name === 'class' && trim($attr->value) === 'hl') {
                continue;
            }

            $el->removeAttribute($attr->name);
        }
    }

    private function cleanStyle(string $style): string
    {
        $kept = [];

        foreach (explode(';', $style) as $decl) {
            if (! str_contains($decl, ':')) {
                continue;
            }
            [$prop, $value] = array_map('trim', explode(':', $decl, 2));
            $prop = strtolower($prop);
            $value = strtolower(preg_replace('/\s+/', '', $value));

            if ($prop === 'color' && $this->isAllowedColor($value)) {
                $kept[] = "color:$value";
            } elseif ($prop === 'text-transform' && $value === 'uppercase') {
                $kept[] = 'text-transform:uppercase';
            } elseif ($prop === 'font-weight' && preg_match('/^(bold|[1-9]00)$/', $value)) {
                $kept[] = "font-weight:$value";
            }
        }

        return implode(';', $kept);
    }

    private function isAllowedColor(string $value): bool
    {
        foreach (self::ALLOWED_COLORS as $hex) {
            if ($value === $hex) {
                return true;
            }
            $r = hexdec(substr($hex, 1, 2));
            $g = hexdec(substr($hex, 3, 2));
            $b = hexdec(substr($hex, 5, 2));
            if ($value === "rgb($r,$g,$b)") {
                return true;
            }
        }

        return false;
    }
}
