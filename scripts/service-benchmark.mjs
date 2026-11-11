import { performance } from "node:perf_hooks";
import { cpuUsage, memoryUsage } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { ProductStore } from "../dist/services/product-store.js";
import { createApp } from "../dist/app.js";

const resultados = [];

function resumen(nombre, tiempos, duracion, cpuInicial, memoriaInicial) {
  const ordenados = [...tiempos].sort((a, b) => a - b);
  const cpu = cpuUsage(cpuInicial);
  const memoria = memoryUsage();

  const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  const p95 = ordenados[Math.ceil(tiempos.length * 0.95) - 1];

  resultados.push({
    servicio: nombre,
    operaciones: tiempos.length,
    promedioMs: Number(promedio.toFixed(4)),
    p95Ms: Number(p95.toFixed(4)),
    maximoMs: Number(ordenados.at(-1).toFixed(4)),
    throughput: Math.round(tiempos.length * 1000 / duracion),
    cpuMs: Number(((cpu.user + cpu.system) / 1000).toFixed(3)),
    heapMB: Number((memoria.heapUsed / 1048576).toFixed(2)),
    rssMB: Number((memoria.rss / 1048576).toFixed(2)),
    heapDeltaMB: Number(
      ((memoria.heapUsed - memoriaInicial.heapUsed) / 1048576).toFixed(2)
    )
  });
}

function medir(nombre, operaciones) {
  const tiempos = [];
  const cpuInicial = cpuUsage();
  const memoriaInicial = memoryUsage();
  const inicio = performance.now();

  for (const operacion of operaciones) {
    const t0 = performance.now();
    operacion();
    tiempos.push(performance.now() - t0);
  }

  resumen(
    nombre,
    tiempos,
    performance.now() - inicio,
    cpuInicial,
    memoriaInicial
  );
}

const store = new ProductStore();
const ids = [];
const N = 1000;

medir("ProductStore crear",
  Array.from({ length: N }, (_, i) => () => {
    const producto = store.create({
      name: `Producto ${i}`,
      sku: `PROD-${i}`,
      price: 100,
      stock: 20
    });
    ids.push(producto.id);
  })
);

medir("ProductStore buscar ID",
  ids.map(id => () => store.getById(id))
);

medir("ProductStore buscar SKU",
  Array.from({ length: N }, (_, i) =>
    () => store.getBySku(`PROD-${i}`)
  )
);

medir("ProductStore listar",
  Array.from({ length: 100 }, () => () => store.list())
);

medir("ProductStore actualizar",
  ids.map(id => () => store.update(id, { price: 150 }))
);

medir("ProductStore stock",
  ids.map(id => () => store.adjustStock(id, 5))
);

medir("ProductStore eliminar",
  ids.map(id => () => store.remove(id))
);

async function medirHttp() {
  const app = createApp();
  const server = app.listen(0);

  await new Promise(resolve => server.once("listening", resolve));

  try {
    const direccion = server.address();
    if (!direccion || typeof direccion === "string") {
      throw new Error("No se pudo obtener el puerto HTTP");
    }

    const url = `http://127.0.0.1:${direccion.port}/health`;

    const calentamiento = await fetch(url);
    if (!calentamiento.ok) {
      throw new Error(`Calentamiento HTTP: ${calentamiento.status}`);
    }
    await calentamiento.arrayBuffer();

    const tiempos = [];
    const cpuInicial = cpuUsage();
    const memoriaInicial = memoryUsage();
    const inicio = performance.now();

    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      const respuesta = await fetch(url);
      if (!respuesta.ok) {
        throw new Error(`Error HTTP: ${respuesta.status}`);
      }
      await respuesta.arrayBuffer();
      tiempos.push(performance.now() - t0);
    }

    resumen(
      "Express HTTP health",
      tiempos,
      performance.now() - inicio,
      cpuInicial,
      memoriaInicial
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())
    );
  }
}

await medirHttp();

console.table(resultados);

mkdirSync("docs/timing/evidencias", { recursive: true });

writeFileSync(
  "docs/timing/evidencias/benchmark-service.json",
  JSON.stringify({
    fecha: new Date().toISOString(),
    node: process.version,
    resultados
  }, null, 2)
);

console.log("Benchmark finalizado y resultados guardados.");
