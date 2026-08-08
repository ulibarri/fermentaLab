/*
 * Cálculo de volúmenes de CO2 disueltos a partir de presión (PSI) y temperatura.
 *
 * Fórmula (Fix, "Principles of Brewing Science" / carta de carbonatación de
 * brewery.org, ampliamente usada en calculadoras de carbonatación forzada):
 *
 *   P = -16.6999 - 0.0101059*T + 0.00116512*T^2
 *       + 0.173354*T*V + 4.24267*V - 0.0684226*V^2
 *
 * donde P = presión en PSI (manométrica), T = temperatura en °F,
 * V = volúmenes de CO2.
 *
 * Aquí se despeja V (volúmenes de CO2) dado P y T, resolviendo la ecuación
 * cuadrática en V:
 *
 *   a*V^2 + b*V + c = 0
 *
 *   a = -0.0684226
 *   b = 0.173354*T + 4.24267
 *   c = -16.6999 - 0.0101059*T + 0.00116512*T^2 - P
 *
 * La API pública de este módulo recibe/entrega temperatura en °C (la unidad
 * que usa el resto de FermentaLab); la conversión a °F es un detalle interno.
 */

const A = -0.0684226;

function celsiusToFahrenheit(celsius) {

    return (celsius * 9) / 5 + 32;

}

function round(value, decimals) {

    const factor =
        Math.pow(10, decimals);

    return Math.round(value * factor) / factor;

}

class CarbonationCalculator {

    static calculate({ psi, temperature }) {

        if (typeof psi !== "number" || Number.isNaN(psi)) {

            throw new Error(
                `psi debe ser un número (recibido: ${psi}).`
            );

        }

        if (typeof temperature !== "number" || Number.isNaN(temperature)) {

            throw new Error(
                `temperature debe ser un número (recibido: ${temperature}).`
            );

        }

        const temperatureF =
            celsiusToFahrenheit(temperature);

        const a = A;

        const b =
            0.173354 * temperatureF + 4.24267;

        const c =
            -16.6999
            - 0.0101059 * temperatureF
            + 0.00116512 * temperatureF * temperatureF
            - psi;

        const discriminant =
            (b * b) - (4 * a * c);

        if (discriminant < 0) {

            throw new Error(
                "No fue posible calcular el volumen de CO2 con los valores proporcionados (fuera del dominio de la fórmula)."
            );

        }

        const sqrtDiscriminant =
            Math.sqrt(discriminant);

        const candidates = [

            (-b + sqrtDiscriminant) / (2 * a),

            (-b - sqrtDiscriminant) / (2 * a)

        ].filter(

            v => Number.isFinite(v) && v >= 0 && v <= 15

        );

        if (candidates.length === 0) {

            throw new Error(
                "No fue posible determinar un volumen de CO2 físicamente válido con los valores proporcionados."
            );

        }

        const co2Volumes =
            Math.min(...candidates);

        return {

            psi,

            temperature,

            co2Volumes: round(co2Volumes, 3)

        };

    }

}

module.exports =
    CarbonationCalculator;
