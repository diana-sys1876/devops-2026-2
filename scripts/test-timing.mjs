import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const modo = process.argv[2] === "productos" ? "productos" : "general";
const carpeta = resolve("docs/timing/evidencias");
mkdirSync(carpeta, { recursive: true });

const archivoVitest = resolve("node_modules/vitest/vitest.mjs");
const archivoReporte = resolve(carpeta, `vitest-${modo}.json`);

const args = ["run"];

if (modo === "productos") {
  args.push("--config", "vitest.productos.config.ts");
}

args.push(
  "--reporter=json",
  `--outputFile=${archivoReporte}`
);

console.log(`Iniciando pruebas: ${modo}`);

const inicio = performance.now();

const proceso = spawnSync(process.execPath, [archivoVitest, ...args], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024
});

const duracionMs = performance.now() - inicio;

if (proceso.stdout) console.log(proceso.stdout);
if (proceso.stderr) console.error(proceso.stderr);

if (proceso.error || proceso.status !== 0) {
  console.error("La ejecución de pruebas falló.");
  process.exitCode = 1;
} else {
  const reporte = JSON.parse(readFileSync(archivoReporte, "utf8"));

  const archivos = (reporte.testResults ?? []).map((archivo) => {
    const pruebas = archivo.assertionResults ?? [];
    const duraciones = pruebas
      .map((prueba) => ({
        nombre: prueba.fullName ?? prueba.title,
        duracionMs: prueba.duration
      }))
      .filter((prueba) => Number.isFinite(prueba.duracionMs));

    return {
      archivo: archivo.name,
      duracionTestsMs: duraciones.reduce(
        (suma, prueba) => suma + prueba.duracionMs, 0
      ),
      pruebas: pruebas.length,
      aprobadas: pruebas.filter((p) => p.status === "passed").length,
      fallidas: pruebas.filter((p) => p.status === "failed").length,
      duraciones
    };
  });

  const resumen = {
    fecha: new Date().toISOString(),
    modo,
    node: process.version,
    duracionTotalMs: Number(duracionMs.toFixed(2)),
    archivos: archivos.length,
    pruebas: reporte.numTotalTests,
    aprobadas: reporte.numPassedTests,
    fallidas: reporte.numFailedTests,
    detalle: archivos
  };

  console.log("\nRESUMEN DE TRAZABILIDAD");
  console.table({
    Modo: modo,
    "Tiempo total (ms)": resumen.duracionTotalMs,
    "Archivos de pruebas": resumen.archivos,
    "Pruebas totales": resumen.pruebas,
    "Pruebas aprobadas": resumen.aprobadas,
    "Pruebas fallidas": resumen.fallidas
  });

  console.log("\nDURACION POR ARCHIVO");
  console.table(
    archivos.map((a) => ({
      archivo: a.archivo.split(/[\\/]/).at(-1),
      pruebas: a.pruebas,
      "Tiempo tests (ms)": a.duracionTestsMs
    }))
  );

  const lentas = archivos
    .flatMap((a) => a.duraciones)
    .sort((a, b) => b.duracionMs - a.duracionMs)
    .slice(0, 5);

  if (lentas.length) {
    console.log("\nCINCO PRUEBAS MAS LENTAS");
    console.table(lentas);
  }

  const salida = resolve(carpeta, `test-timing-${modo}.json`);
  writeFileSync(salida, JSON.stringify(resumen, null, 2));

  console.log(`Resultados guardados en: ${salida}`);
}

