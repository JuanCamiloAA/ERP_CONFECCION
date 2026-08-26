/**
 * Pruebas del monto en letras. Se ejecutan con `npm run test:js`.
 *
 * Usan el runner de Node (`node --test`), que lee TypeScript directamente: no hace falta
 * instalar ninguna dependencia de pruebas para el front.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amountToWords } from './numberToWords.ts';

test('cero', () => {
    assert.equal(amountToWords(0), 'CERO PESOS M/CTE.');
});

test('CIEN exacto y CIENTO con resto', () => {
    assert.equal(amountToWords(100), 'CIEN PESOS M/CTE.');
    assert.equal(amountToWords(101), 'CIENTO UN PESOS M/CTE.');
    assert.equal(amountToWords(150), 'CIENTO CINCUENTA PESOS M/CTE.');
});

test('del 21 al 29 en una sola palabra', () => {
    assert.equal(amountToWords(21), 'VEINTIÚN PESOS M/CTE.');
    assert.equal(amountToWords(29), 'VEINTINUEVE PESOS M/CTE.');
    assert.equal(amountToWords(21000), 'VEINTIÚN MIL PESOS M/CTE.');
});

test('la Y solo va entre decena y unidad', () => {
    assert.equal(amountToWords(42), 'CUARENTA Y DOS PESOS M/CTE.');
    assert.equal(amountToWords(40), 'CUARENTA PESOS M/CTE.');
    assert.equal(amountToWords(342), 'TRESCIENTOS CUARENTA Y DOS PESOS M/CTE.');
});

test('MIL no lleva UN delante', () => {
    assert.equal(amountToWords(1000), 'MIL PESOS M/CTE.');
    assert.equal(amountToWords(250000), 'DOSCIENTOS CINCUENTA MIL PESOS M/CTE.');
});

test('UN MILLÓN en singular y MILLONES en plural', () => {
    assert.equal(amountToWords(1000000), 'UN MILLÓN PESOS M/CTE.');
    assert.equal(amountToWords(1001000), 'UN MILLÓN MIL PESOS M/CTE.');
    assert.equal(amountToWords(2500000), 'DOS MILLONES QUINIENTOS MIL PESOS M/CTE.');
});

test('el monto mas alto que se espera en un anticipo', () => {
    // Techo realista: ningun anticipo de nomina llega aqui, pero el comprobante no debe
    // romperse si alguien digita de mas.
    assert.equal(amountToWords(999999999), 'NOVECIENTOS NOVENTA Y NUEVE MILLONES NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE PESOS M/CTE.');
});

test('singular y redondeo a pesos', () => {
    assert.equal(amountToWords(1), 'UN PESO M/CTE.');
    assert.equal(amountToWords(1.4), 'UN PESO M/CTE.');
    assert.equal(amountToWords('175000.00'), 'CIENTO SETENTA Y CINCO MIL PESOS M/CTE.');
});

test('valores invalidos no rompen la hoja', () => {
    assert.equal(amountToWords(null), 'CERO PESOS M/CTE.');
    assert.equal(amountToWords(undefined), 'CERO PESOS M/CTE.');
    assert.equal(amountToWords('abc'), 'CERO PESOS M/CTE.');
});
