'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translateDisplayText } from '@/i18n/displayText';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'SVG',
  'PATH',
]);

const ATTRIBUTES_TO_TRANSLATE = ['placeholder', 'title', 'aria-label'];
const PROTECTED_UI_COPY = new Set([
  'cumplimiento y auditoría',
]);

function normalizeProtectedCopy(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function shouldSkipElement(element: Element | null) {
  if (!element) return true;

  const tag = element.tagName;
  if (SKIP_TAGS.has(tag)) return true;

  if (element.closest('[contenteditable="true"]')) return true;
  if (element.closest('[data-i18n-skip="true"]')) return true;
  if (element.closest('[data-no-translate="true"]')) return true;

  return false;
}

function translateVisibleText(value: string | null | undefined) {
  const original = String(value ?? '');
  const compact = original.trim();

  if (!compact) return original;
  const normalizedCopy = normalizeProtectedCopy(compact);
  if (PROTECTED_UI_COPY.has(normalizedCopy)) {
    return original;
  }

  const translated = translateDisplayText(compact, 'en', 'db-display-residual');

  if (!translated || translated === compact) return original;

  return original.replace(compact, translated);
}

function translateTextNode(node: Text) {
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;

  if (parent && ['INPUT', 'TEXTAREA'].includes(parent.tagName)) return;

  const translated = translateVisibleText(node.nodeValue);
  if (translated !== node.nodeValue) {
    node.nodeValue = translated;
  }
}

function translateElement(element: Element) {
  if (shouldSkipElement(element)) return;

  if (element instanceof HTMLOptionElement) {
    const translated = translateVisibleText(element.textContent);
    if (translated !== element.textContent) {
      element.textContent = translated;
    }
    return;
  }

  for (const attr of ATTRIBUTES_TO_TRANSLATE) {
    if (!element.hasAttribute(attr)) continue;

    const current = element.getAttribute(attr);
    const translated = translateVisibleText(current);

    if (translated !== current) {
      element.setAttribute(attr, translated);
    }
  }
}

function walk(root: ParentNode) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = (node as Text).parentElement;
          return shouldSkipElement(parent)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          return shouldSkipElement(node as Element)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateElement(node as Element);
    }

    node = walker.nextNode();
  }
}

export default function EnglishDbDisplayTextGuard() {
  const { locale } = useLanguage();

  useEffect(() => {
    if (locale !== 'en') return;

    const run = () => walk(document.body);

    run();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (target.nodeType === Node.TEXT_NODE) {
            translateTextNode(target as Text);
          }
          continue;
        }

        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.nodeType === Node.ELEMENT_NODE) {
            translateElement(target as Element);
          }
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text);
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            translateElement(element);
            walk(element);
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES_TO_TRANSLATE,
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}
