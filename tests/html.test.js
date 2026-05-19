import { describe, expect, it } from 'vitest';

import { escaparHtmlSeguro as escaparHtmlSeguroTs } from '../src/utils/html.ts';

const { escaparHtmlSeguro: escaparHtmlSeguroLegado } = globalThis;

describe('escaparHtmlSeguro em TypeScript', () => {
  const casos = [
    ['string normal', 'texto normal'],
    ['string com <script>', '<script>alert("x")</script>'],
    ['string com aspas duplas', 'diz "oi"'],
    ['string com aspas simples', "diz 'oi'"],
    ['string com &', 'A & B'],
    ['string com tags HTML', '<strong class="x">Valor & teste</strong>'],
    ['string vazia', ''],
    ['null', null],
    ['undefined', undefined],
    ['numero', 123],
    ['booleano true', true],
    ['booleano false', false],
    ['objeto', { nome: '<b>Teste</b>' }],
    ['array', ['<a>', 'B & C']]
  ];

  it.each(casos)('mantem o comportamento legado para %s', (_, valor) => {
    expect(escaparHtmlSeguroTs(valor)).toBe(escaparHtmlSeguroLegado(valor));
  });

  it('escapa caracteres especiais na mesma ordem da versao antiga', () => {
    expect(escaparHtmlSeguroTs(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#039;');
  });
});
