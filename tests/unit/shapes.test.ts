import { describe, expect, it } from 'vitest';
import { clientMessage } from '../../src/worker/validation';

describe('contrato de figuras', () => {
  it.each(['rect', 'ellipse', 'line', 'arrow'])('permite crear %s fuera del escenario', shape => {
    expect(clientMessage.safeParse({ t: 'shape.add', shape, x: -100, y: 200 }).success).toBe(true);
  });
  it.each([
    { shape: 'svg', x: 0, y: 0 }, { shape: 'rect', x: Infinity, y: 0 },
    { shape: 'rect', x: 0, y: 0, svg: '<script>bad()</script>' }, { shape: 'circle', x: 0, y: 0 },
  ])('rechaza figuras y campos no permitidos', data => {
    expect(clientMessage.safeParse({ t: 'shape.add', ...data }).success).toBe(false);
  });
  it.each([
    { fill: null }, { fill: '#12efab', borderColor: '#abcdef', borderWidth: 64 }, { borderWidth: 0 },
  ])('permite estilos y relleno transparente', patch => {
    expect(clientMessage.safeParse({ t: 'item.patch', id: crypto.randomUUID(), patch }).success).toBe(true);
  });
  it.each([
    { fill: 'url(https://example.com/shape)' }, { borderColor: '<svg>' }, { borderWidth: -1 },
    { borderWidth: 65 }, { borderWidth: NaN }, { borderWidth: '12' }, { shape: 'arrow' },
  ])('rechaza estilos inseguros, tipos incorrectos o grosor fuera de límites', patch => {
    expect(clientMessage.safeParse({ t: 'item.patch', id: crypto.randomUUID(), patch }).success).toBe(false);
  });
});
